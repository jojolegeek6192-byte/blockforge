// dashboardRoutes.js
const express = require('express');
const { getDashboardStats, listAllPurchases, listUsers } = require('../db/models');
const { requireAuth, requireOwner } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireOwner);

router.get('/stats', (req, res) => {
  res.json({ stats: getDashboardStats() });
});

router.get('/sales', (req, res) => {
  res.json({ sales: listAllPurchases() });
});

router.get('/users', (req, res) => {
  const users = listUsers().map(({ passwordHash, ...rest }) => rest);
  res.json({ users });
});

module.exports = router;
