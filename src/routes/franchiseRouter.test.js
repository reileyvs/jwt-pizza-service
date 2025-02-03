const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let admin;
let franchiseName;
let storeName;

if(process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(1000 * 60 * 60);
}

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const loginRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = loginRes.body.token;
  admin = await createAdminUser();
  franchiseName = randomName();
  storeName = randomName();
});

test('getFranchises', async () => {
    const res = await request(app).get('/api/franchise');
    expect(res.status).toBe(200);
    expect(res.body==null).toBe(false);
});

test('getUserFranchises as admin', async () => {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = await request(app).get('/api/franchise/1').set('Authorization', 'Bearer ' + adminRes.body.token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(await DB.getUserFranchises(1));
});

test('createFranchise not admin', async () => {
    const res = await request(app).post('/api/franchise').set('Authorization', 'Bearer ' + testUserAuthToken).send({ name: 'new franchise' });
    expect(res.status).toBe(403);
});

test('createFranchise as admin', async () => {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = await request(app).post('/api/franchise').set('Authorization', 'Bearer ' + adminRes.body.token).send({ name: franchiseName, admins: [{ email: admin.email}]});
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(franchiseName);
});

test('deleteFranchise not admin', async () => {
    const res = await request(app).delete('/api/franchise/1').set('Authorization', 'Bearer ' + testUserAuthToken);
    expect(res.status).toBe(403);
});

test('deleteFranchise as admin', async () => {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = await request(app).delete('/api/franchise/1').set('Authorization', 'Bearer ' + adminRes.body.token);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('franchise deleted');
});

test('create store not admin', async () => {
    const res = await request(app).post('/api/franchise/1/store').set('Authorization', 'Bearer ' + testUserAuthToken).send({ name: 'new store' });
    expect(res.status).toBe(403);
});

test('create store as admin', async () => {
    const info = await createFranchise();
    const res = await request(app).post(`/api/franchise/${info[0]}/store`).set('Authorization', 'Bearer ' + info[1].body.token).send({ franchiseId: info[0], name: storeName });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(storeName);
});

test('delete store not admin', async () => {
    const res = await request(app).delete('/api/franchise/1/store/1').set('Authorization', 'Bearer ' + testUserAuthToken);
    expect(res.status).toBe(403);
});

test('delete store as admin', async () => {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = await request(app).delete('/api/franchise/1/store/1').set('Authorization', 'Bearer ' + adminRes.body.token);
    expect(res.status).toBe(200);
});

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createFranchise() {
    const adminRes = await request(app).put('/api/auth').send(admin);
    const res = await request(app).post('/api/franchise').set('Authorization', 'Bearer ' + adminRes.body.token).send({ name: franchiseName, admins: [{ email: admin.email}]});
    return [res.body.id, adminRes];
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
  }