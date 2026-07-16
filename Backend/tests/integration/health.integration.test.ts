import { createApp } from '../../src/app';
import request from 'supertest';

describe('Health Check Integration Test', () => {
  const app = createApp();

  it('should return 200 and health status on GET /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Vaulty Backend is running',
      status: expect.any(String),
      timestamp: expect.any(String),
      uptime: expect.any(Number),
    });
    expect(response.body.checks).toEqual(
      expect.objectContaining({
        prisma: expect.objectContaining({ status: expect.any(String) }),
        redis: expect.objectContaining({ status: expect.any(String) }),
        workers: expect.objectContaining({ status: expect.any(String) }),
      })
    );
  });

  it('should return 404 for non-existent routes', async () => {
    const response = await request(app).get('/non-existent-route');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });
});
