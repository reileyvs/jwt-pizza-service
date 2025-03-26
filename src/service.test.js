const request = require('supertest');
const app = require('./service');

test('wrong api call', async () => {
    const res = await request(app).get('/api/bauth');
    expect(res.status).toBe(404);
});

test('call docs', async () => {
    const res = await request(app).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.body.version).toBeDefined();
    expect(res.body.endpoints).toBeDefined();
    expect(res.body.config).toBeDefined();
});

test('call root', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('welcome to JWT Pizza');
    expect(res.body.version).toBeDefined(); 
});