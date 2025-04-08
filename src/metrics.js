const config = require('./config');
const os = require('os');
const si = require('systeminformation');

class Metric {
  constructor() {
    this.requestTracker = this.requestTracker.bind(this)
    this.httpMetrics = {get: 0, post: 0, put: 0, delete: 0};
    this.systemMetrics = {cpu: 0, memory: 0, latency: 0, pizzaLatency: 0};
    this.userMetrics = {users: 0};
    this.purchaseMetrics = {sold: 0, failed: 0, revenue: 0};
    this.authMetrics = {successful: 0, failed: 0};
    this.sendMetricsPeriodically(15000); 
    this.resetUserMetrics();
  }
  addHttpMetrics() {
    let http = this.httpMetrics;
    let arr = [];
    arr.push(this.createMetrics("GET", http.get, "sum", "1"));
    arr.push(this.createMetrics("POST", http.post, "sum", "1"));
    arr.push(this.createMetrics("PUT", http.put, "sum", "1"));
    arr.push(this.createMetrics("DELETE", http.delete, "sum", "1"));
    arr.push(this.createMetrics("TOTAL", http.get+http.post+http.put+http.delete, "sum", "1"))
    return arr;

  }
  addSystemMetrics() {
    let system = this.systemMetrics;
    system.cpu = this.getCpuUsagePercentage();
    system.memory = Math.floor(this.getMemoryUsagePercentage());
    let arr = [];
    arr.push(this.createMetrics("CPU", system.cpu, "gauge", "%"));
    arr.push(this.createMetrics("MEMORY", system.memory, "gauge", "%"));
    arr.push(this.createMetrics("GEN_LATENCY", system.latency, "sum", "ms"));
    arr.push(this.createMetrics("PIZZA_LATENCY", system.pizzaLatency, "sum", "ms"));
    return arr;
  }
  addUserMetrics() {
    return this.createMetrics("ACTIVE_USERS", this.userMetrics.users, "sum", "1");
  }
  plusUserMetrics() {
    this.userMetrics.users += 1;
  }
  reduceUserMetrics() {
    if (this.userMetrics.users > 0) {
      this.userMetrics.users -= 1
    }
  }
  resetUserMetrics() {
    setInterval(() => {
      if (this.userMetrics.users > 0) {
        this.userMetrics.users -= 1
      }
    }, 2000000)
  }
  addPurchaseMetrics() {
    const purchase = this.purchaseMetrics;
    let arr = [];
    arr.push(this.createMetrics("SOLD", purchase.sold, "sum", "1"));
    arr.push(this.createMetrics("FAILED_PIZZAS", purchase.failed, "sum", "1"));
    arr.push(this.createMetrics("REVENUE", purchase.revenue, "sum", "1"));

    return arr;
  }
  pizzaOrder(isSuccessful, pizzas) {
    if (isSuccessful) {
      this.purchaseMetrics.sold += pizzas;
    } else {
      this.purchaseMetrics.failed += pizzas;
    }
  }
  addRevenue(price) {
    this.purchaseMetrics.revenue += price;
  }
  addLatency(latency) {
    if (this.systemMetrics.latency != 0) {
      this.systemMetrics.latency = (latency + this.systemMetrics.latency) / 2
    }
    this.systemMetrics.latency = latency;
  }
  addPizzaLatency(latency) {
    if (this.systemMetrics.pizzaLatency != 0) {
      this.systemMetrics.pizzaLatency = (latency + this.systemMetrics.pizzaLatency) / 2
    }
    this.systemMetrics.pizzaLatency = latency;
  }
  plusAuthMetrics(isSuccessful) {
    if (isSuccessful) {
      this.authMetrics.successful += 1;
    } else {
      this.authMetrics.failed += 1;
    }
    if (this.authMetrics.successful > 1000 || this.authMetrics.failed > 1000) {
      this.authMetrics.successful = 0;
      this.authMetrics.failed = 0;
    }
  }
  addAuthMetrics() {
    let arr = [];
    arr.push(this.createMetrics("SUCCESSFUL", this.authMetrics.successful, "sum", "1"));
    arr.push(this.createMetrics("FAILED", this.authMetrics.failed, "sum", "1"));
    return arr;
  }
  sendMetricsPeriodically(period) {
    setInterval(() => {
      try {
        const buf = [];
        const http = this.addHttpMetrics()
        const system = this.addSystemMetrics()
        const user = this.addUserMetrics()
        const purchase = this.addPurchaseMetrics()
        const auth = this.addAuthMetrics()

        http.forEach(value => buf.push(value));
        system.forEach(value => buf.push(value));
        buf.push(user);
        purchase.forEach(value => buf.push(value));
        auth.forEach(value => buf.push(value));
        buf.forEach(metric => {
          this.sendMetricToGrafana(metric);
        })
        //this.resetMetrics();
      } catch (error) {
        console.log('Error sending metrics', error);
      }
    }, period);
  }

  createMetrics(metricName, metricValue, type, unit) {
    let intOrDouble = "asInt";
    if (!Number.isInteger(metricValue)) {
      intOrDouble = "asDouble";
    }
    const metric = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: metricName,
                  unit: unit,
                  [type]: {
                    dataPoints: [
                      {
                        [intOrDouble]: metricValue,
                        timeUnixNano: Date.now() * 1000000,
                        "attributes": [
                          {
                            "key": "source",
                            "value": { "stringValue": "jwt-pizza-service" }
                          }
                        ]
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    
    if (type === 'sum') {
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
      metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
    }
    return metric;
  }
  sendMetricToGrafana(metric) {
    const body = JSON.stringify(metric);
    fetch(`${config.metrics.url}`, {
      method: 'POST',
      body: body,
      headers: { Authorization: `Bearer ${config.metrics.api_key}`, 'Content-Type': 'application/json' },
    })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
        });
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
  }
  requestTracker(req, res, next) {
    const method = req.method;
    switch(method) {
      case "GET":
        this.httpMetrics.get++; 
        break;
      case "POST":
        this.httpMetrics.post++;
        break;
      case "PUT":
        this.httpMetrics.put++;
        break;
      case "DELETE":
        this.httpMetrics.delete++;
        break;
      default:
        console.log("Method not found");
    }
    next();
  }


  getCpuUsagePercentage() {
    si.currentLoad().then(data => {
        return data.currentLoad
    }).catch(error => {
        console.error(error);
    });
  }

  getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
  }

  resetMetrics() {
    for (const key in this.httpMetrics) {
      this.httpMetrics[key] = 0;
    }
  }
}
module.exports = new Metric();