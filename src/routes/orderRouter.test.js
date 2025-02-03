const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let admin;

if(process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(1000 * 60 * 60);
}

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const loginRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = loginRes.body.token;
  admin = await createAdminUser();
});

test('get menu', async () => {
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(await DB.getMenu());
});

test('add menu item not admin', async () => {
    const res = (await request(app).put('/api/order/menu').set('Authorization', `Bearer ${testUserAuthToken}`).send({ id: 1, title: 'Veggie', image:'pizza1.png', price: 0.05, description:'Too yumm' }));
    expect(res.status).toBe(403);
});

test('add menu item admin', async () => {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = (await request(app).put('/api/order/menu').set('Authorization', `Bearer ${adminRes.body.token}`).send({ id: 1, title: 'Veggie', image:'pizza1.png', price: 0.05, description:'Too yumm' }));
    expect(res.status).toBe(200);
});

test('get orders', async () => {
    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body==null).toBe(false);
});

test('create order', async () => {
    const res = await request(app).post('/api/order').set('Authorization', `Bearer ${testUserAuthToken}`).send({ franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }]});
    expect(res.status).toBe(200);
    expect(res.body==null).toBe(false)
});

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}