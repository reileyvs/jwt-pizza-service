const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

if(process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(1000 * 60 * 60);
}

beforeEach(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const loginRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = loginRes.body.token;
  admin = await createAdminUser();
});

test('register', async () => {
  const user = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
  user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(user);
  expect(registerRes.status).toBe(200);
});

test('register without password', async () => {
    const user = { name: 'pizza diner', email: 'reg@test.com'};
    user.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(user);
    expect(registerRes.status).toBe(400);
  });

test('login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
  
    const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
    expect(loginRes.body.user).toMatchObject(user);
  });

test('logout with login', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${loginRes.body.token}`)
    expect(logoutRes.status).toBe(200);
});

test('logout without login', async () => {
    const logoutRes = await request(app).delete('/api/auth');
    expect(logoutRes.status).toBe(401);
})

test('update user not admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(testUser);
    const updateUserRes = await request(app).put('/api/auth/1').send({ email: 'yeehaw', password: 'pass' }).set('Authorization', `Bearer ${loginRes.body.token}`);
    expect(updateUserRes.status).toBe(403);
});

test('update user as admin', async () => {
    const loginRes = await request(app).put('/api/auth').send(admin);
    const updateUserRes = await request(app).put('/api/auth/1').send(admin).set('Authorization', `Bearer ${loginRes.body.token}`)
    expect(updateUserRes.status).toBe(200);
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
