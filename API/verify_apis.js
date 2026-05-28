/**
 * AgnoHire API Endpoints Tester & Verification Suite
 * Designed to test and report status of all major system endpoints.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000';

// ANSI escape codes for clean terminal color reporting
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

const results = [];

function logSection(title) {
  console.log(`\n${BOLD}${MAGENTA}======================================================================${RESET}`);
  console.log(`${BOLD}${MAGENTA}>> ${title}${RESET}`);
  console.log(`${BOLD}${MAGENTA}======================================================================${RESET}`);
}

async function recordResult(category, method, endpoint, status, responseTime, errorMsg = null) {
  const isOk = status >= 200 && status < 300;
  results.push({
    category,
    method,
    endpoint,
    status,
    responseTime: `${responseTime}ms`,
    success: isOk,
    error: errorMsg
  });

  const statusColor = isOk ? GREEN : RED;
  const timeColor = responseTime < 200 ? GREEN : responseTime < 500 ? YELLOW : RED;

  console.log(
    `[${category.padEnd(12)}] ` +
    `${BOLD}${method.padEnd(6)}${RESET} ` +
    `${endpoint.padEnd(50)} ` +
    `-> Status: ${statusColor}${status}${RESET} ` +
    `(${timeColor}${responseTime}ms${RESET})` +
    (errorMsg ? ` -> ${RED}${errorMsg}${RESET}` : '')
  );
}

async function request(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'AgnoHire-Verification-Suite/1.0',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const start = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    const time = Date.now() - start;

    let responseData = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      await response.text();
    }

    return {
      status: response.status,
      time,
      data: responseData,
      ok: response.ok
    };
  } catch (err) {
    const time = Date.now() - start;
    return {
      status: 0,
      time,
      data: null,
      ok: false,
      error: err.message
    };
  }
}

async function runTests() {
  logSection('1. HEALTH CHECK & INFRASTRUCTURE');

  const health = await request('GET', '/health');
  await recordResult('System', 'GET', '/health', health.status, health.time, health.error);

  logSection('2. AUTHENTICATION (SEED CREDENTIALS)');

  const roles = [
    { name: 'Superadmin', email: 'superadmin@agnohire.com', pass: 'SuperAdmin@123' },
    { name: 'Admin', email: 'admin@it.agnohire.com', pass: 'Admin@123456' },
    { name: 'HR Manager', email: 'hr@it.agnohire.com', pass: 'Hr@123456' },
    { name: 'Recruiter', email: 'recruiter@it.agnohire.com', pass: 'Recruiter@123' }
  ];

  const tokens = {};
  for (const role of roles) {
    const res = await request('POST', '/api/v1/auth/login', {
      email: role.email,
      password: role.pass
    });

    if (res.ok && res.data?.data?.accessToken) {
      tokens[role.name] = res.data.data.accessToken;
      await recordResult('Auth', 'POST', `/api/v1/auth/login [As ${role.name}]`, res.status, res.time);
    } else {
      await recordResult('Auth', 'POST', `/api/v1/auth/login [As ${role.name}]`, res.status, res.time, res.data?.message || res.error || 'Login failed');
    }
  }

  const superToken = tokens['Superadmin'];
  const hrToken = tokens['HR Manager'];
  const recToken = tokens['Recruiter'];
  const adminToken = tokens['Admin'];

  if (!superToken || !hrToken || !recToken || !adminToken) {
    console.log(`\n${BOLD}${RED}CRITICAL: Seed login failed. Ensure database seeds are active. aborting additional auth testing.${RESET}`);
  }

  // Me Check
  if (superToken) {
    const meRes = await request('GET', '/api/v1/auth/me', null, superToken);
    await recordResult('Auth', 'GET', '/api/v1/auth/me', meRes.status, meRes.time, meRes.error || meRes.data?.message);
  }

  logSection('3. SYSTEM READ CHECKS (GET LISTS & DYNAMIC EXTRACTION)');

  let sectorId = null;
  let candidateId = null;
  let userId = null;
  let bankId = null;
  let notificationId = null;
  let interviewId = null;

  // Sectors List
  if (superToken) {
    const sectorsRes = await request('GET', '/api/v1/sectors', null, superToken);
    await recordResult('Sectors', 'GET', '/api/v1/sectors', sectorsRes.status, sectorsRes.time, sectorsRes.error || sectorsRes.data?.message);
    if (sectorsRes.ok && sectorsRes.data?.data?.sectors?.length > 0) {
      sectorId = sectorsRes.data.data.sectors[0].id;
      console.log(`  └─ ${CYAN}Extracted active sector ID for details checking: ${sectorId}${RESET}`);
    }
  }

  // Candidates List
  if (hrToken) {
    const candidatesRes = await request('GET', '/api/v1/candidates', null, hrToken);
    await recordResult('Candidates', 'GET', '/api/v1/candidates', candidatesRes.status, candidatesRes.time, candidatesRes.error || candidatesRes.data?.message);
    if (candidatesRes.ok && candidatesRes.data?.data?.candidates?.length > 0) {
      candidateId = candidatesRes.data.data.candidates[0].id;
      console.log(`  └─ ${CYAN}Extracted active candidate ID for details checking: ${candidateId}${RESET}`);
    }

    const listsRes = await request('GET', '/api/v1/candidates/lists', null, hrToken);
    await recordResult('Candidates', 'GET', '/api/v1/candidates/lists', listsRes.status, listsRes.time, listsRes.error || listsRes.data?.message);
  }

  // Users List
  if (superToken) {
    const usersRes = await request('GET', '/api/v1/users', null, superToken);
    await recordResult('Users', 'GET', '/api/v1/users', usersRes.status, usersRes.time, usersRes.error || usersRes.data?.message);
    if (usersRes.ok && usersRes.data?.data?.users?.length > 0) {
      userId = usersRes.data.data.users[0].id;
      console.log(`  └─ ${CYAN}Extracted active user ID for details checking: ${userId}${RESET}`);
    }

    // System configurations
    const configsRes = await request('GET', '/api/v1/users/config/all', null, superToken);
    await recordResult('Config', 'GET', '/api/v1/users/config/all', configsRes.status, configsRes.time, configsRes.error || configsRes.data?.message);

    const templatesRes = await request('GET', '/api/v1/users/config/email-templates', null, superToken);
    await recordResult('Config', 'GET', '/api/v1/users/config/email-templates', templatesRes.status, templatesRes.time, templatesRes.error || templatesRes.data?.message);
  }

  // Question Banks List
  if (recToken) {
    const banksRes = await request('GET', '/api/v1/questions/banks', null, recToken);
    await recordResult('Questions', 'GET', '/api/v1/questions/banks', banksRes.status, banksRes.time, banksRes.error || banksRes.data?.message);
    if (banksRes.ok && banksRes.data?.data?.banks?.length > 0) {
      bankId = banksRes.data.data.banks[0].id;
      console.log(`  └─ ${CYAN}Extracted active question bank ID for details checking: ${bankId}${RESET}`);
    }

    const randomQRes = await request('GET', '/api/v1/questions/for-interview', null, recToken);
    await recordResult('Questions', 'GET', '/api/v1/questions/for-interview', randomQRes.status, randomQRes.time, randomQRes.error || randomQRes.data?.message);
  }

  // Interviews List
  if (recToken) {
    const interviewsRes = await request('GET', '/api/v1/interviews', null, recToken);
    await recordResult('Interviews', 'GET', '/api/v1/interviews', interviewsRes.status, interviewsRes.time, interviewsRes.error || interviewsRes.data?.message);
    if (interviewsRes.ok && interviewsRes.data?.data?.interviews?.length > 0) {
      interviewId = interviewsRes.data.data.interviews[0].id;
      console.log(`  └─ ${CYAN}Extracted active interview ID for details checking: ${interviewId}${RESET}`);
    }
  }

  // Notifications List
  if (hrToken) {
    const notifyRes = await request('GET', '/api/v1/notifications', null, hrToken);
    await recordResult('Notifications', 'GET', '/api/v1/notifications', notifyRes.status, notifyRes.time, notifyRes.error || notifyRes.data?.message);
    if (notifyRes.ok && notifyRes.data?.data?.notifications?.length > 0) {
      notificationId = notifyRes.data.data.notifications[0].id;
      console.log(`  └─ ${CYAN}Extracted active notification ID for details checking: ${notificationId}${RESET}`);
    }
  }

  // Analytics
  if (superToken) {
    const globalRes = await request('GET', '/api/v1/analytics/global', null, superToken);
    await recordResult('Analytics', 'GET', '/api/v1/analytics/global', globalRes.status, globalRes.time, globalRes.error || globalRes.data?.message);

    const trendsRes = await request('GET', '/api/v1/analytics/trends', null, superToken);
    await recordResult('Analytics', 'GET', '/api/v1/analytics/trends', trendsRes.status, trendsRes.time, trendsRes.error || trendsRes.data?.message);

    const auditRes = await request('GET', '/api/v1/analytics/audit-logs', null, superToken);
    await recordResult('Analytics', 'GET', '/api/v1/analytics/audit-logs', auditRes.status, auditRes.time, auditRes.error || auditRes.data?.message);

    if (sectorId) {
      const sectorAnRes = await request('GET', `/api/v1/analytics/sector/${sectorId}`, null, superToken);
      await recordResult('Analytics', 'GET', `/api/v1/analytics/sector/:sectorId`, sectorAnRes.status, sectorAnRes.time, sectorAnRes.error || sectorAnRes.data?.message);
    }
  }

  logSection('4. PARAMETERIZED DETAILS VERIFICATION');

  // Sector details
  if (superToken && sectorId) {
    const secOne = await request('GET', `/api/v1/sectors/${sectorId}`, null, superToken);
    await recordResult('Sectors', 'GET', `/api/v1/sectors/:id`, secOne.status, secOne.time, secOne.error || secOne.data?.message);

    const secDom = await request('GET', `/api/v1/sectors/${sectorId}/domains`, null, superToken);
    await recordResult('Sectors', 'GET', `/api/v1/sectors/:id/domains`, secDom.status, secDom.time, secDom.error || secDom.data?.message);
  }

  // Candidate details
  if (hrToken && candidateId) {
    const candOne = await request('GET', `/api/v1/candidates/${candidateId}`, null, hrToken);
    await recordResult('Candidates', 'GET', `/api/v1/candidates/:id`, candOne.status, candOne.time, candOne.error || candOne.data?.message);
  }

  // User details & skills
  if (superToken && userId) {
    const userOne = await request('GET', `/api/v1/users/${userId}`, null, superToken);
    await recordResult('Users', 'GET', `/api/v1/users/:id`, userOne.status, userOne.time, userOne.error || userOne.data?.message);

    const userSkills = await request('GET', `/api/v1/users/${userId}/skills`, null, superToken);
    await recordResult('Users', 'GET', `/api/v1/users/:id/skills`, userSkills.status, userSkills.time, userSkills.error || userSkills.data?.message);
  }

  // Question Bank questions
  if (recToken && bankId) {
    const qList = await request('GET', `/api/v1/questions/banks/${bankId}/questions`, null, recToken);
    await recordResult('Questions', 'GET', `/api/v1/questions/banks/:bankId/questions`, qList.status, qList.time, qList.error || qList.data?.message);
  }

  // Interview details
  if (recToken && interviewId) {
    const ivOne = await request('GET', `/api/v1/interviews/${interviewId}`, null, recToken);
    await recordResult('Interviews', 'GET', `/api/v1/interviews/:id`, ivOne.status, ivOne.time, ivOne.error || ivOne.data?.message);
  }

  logSection('5. CRUD / MUTATIVE WRITE ENDPOINTS VERIFICATION (WITH TEARDOWN CLEANUP)');

  // Sector CRUD
  if (superToken) {
    console.log(`\n${BOLD}[Sectors CRUD Execution]${RESET}`);
    const tempSectorData = {
      name: 'Temp Test QA Sector',
      type: 'QA',
      adminName: 'QA Admin',
      adminEmail: 'qa-admin-test-temp@agnohire.com',
      adminPassword: 'Admin@123456Password!',
      hrName: 'QA HR',
      hrEmail: 'qa-hr-test-temp@agnohire.com',
      hrPassword: 'Hr@123456Password!',
      domains: [{ name: 'Manual Testing' }, { name: 'Automation Testing' }]
    };

    const createSectorRes = await request('POST', '/api/v1/sectors', tempSectorData, superToken);
    await recordResult('Sectors', 'POST', '/api/v1/sectors [CREATE TEMP]', createSectorRes.status, createSectorRes.time, createSectorRes.error || createSectorRes.data?.message);

    if (createSectorRes.ok && createSectorRes.data?.data?.sector?.id) {
      const createdSectorId = createSectorRes.data.data.sector.id;

      // Update Sector
      const updateSectorRes = await request('PUT', `/api/v1/sectors/${createdSectorId}`, { name: 'Temp Test QA Sector (Updated)' }, superToken);
      await recordResult('Sectors', 'PUT', '/api/v1/sectors/:id [UPDATE TEMP]', updateSectorRes.status, updateSectorRes.time, updateSectorRes.error || updateSectorRes.data?.message);

      // Delete Sector (Soft)
      const deleteSectorRes = await request('DELETE', `/api/v1/sectors/${createdSectorId}`, null, superToken);
      await recordResult('Sectors', 'DELETE', '/api/v1/sectors/:id [SOFT DELETE TEMP]', deleteSectorRes.status, deleteSectorRes.time, deleteSectorRes.error || deleteSectorRes.data?.message);

      // Deep database cleanup of users created for the temp sector
      try {
        await prisma.user.deleteMany({
          where: { sectorId: createdSectorId }
        });
        await prisma.domain.deleteMany({
          where: { sectorId: createdSectorId }
        });
        await prisma.sector.delete({
          where: { id: createdSectorId }
        });
        console.log(`  └─ ${GREEN}Cleaned up temporary test sector & users from database successfully.${RESET}`);
      } catch (dbErr) {
        console.log(`  └─ ${RED}Cleanup error: ${dbErr.message}${RESET}`);
      }
    }
  }

  // Candidate CRUD
  if (hrToken) {
    console.log(`\n${BOLD}[Candidates CRUD Execution]${RESET}`);
    const tempCandidateData = {
      name: 'John QA Candidate',
      email: 'john-qa-test-temp@agnohire.com',
      phone: '1234567890',
      experienceLevel: 'mid',
      skills: ['NodeJS', 'Automation']
    };

    const createCandRes = await request('POST', '/api/v1/candidates', tempCandidateData, hrToken);
    await recordResult('Candidates', 'POST', '/api/v1/candidates [CREATE TEMP]', createCandRes.status, createCandRes.time, createCandRes.error || createCandRes.data?.message);

    if (createCandRes.ok && createCandRes.data?.data?.candidate?.id) {
      const createdCandId = createCandRes.data.data.candidate.id;

      // Update Candidate
      const updateCandRes = await request('PUT', `/api/v1/candidates/${createdCandId}`, { name: 'John QA Candidate (Updated)' }, hrToken);
      await recordResult('Candidates', 'PUT', '/api/v1/candidates/:id [UPDATE TEMP]', updateCandRes.status, updateCandRes.time, updateCandRes.error || updateCandRes.data?.message);

      // Delete Candidate (Soft)
      const deleteCandRes = await request('DELETE', `/api/v1/candidates/${createdCandId}`, null, hrToken);
      await recordResult('Candidates', 'DELETE', '/api/v1/candidates/:id [SOFT DELETE TEMP]', deleteCandRes.status, deleteCandRes.time, deleteCandRes.error || deleteCandRes.data?.message);

      // Deep database hard-delete of the temp candidate to avoid email database pollution
      try {
        await prisma.candidate.delete({
          where: { id: createdCandId }
        });
        console.log(`  └─ ${GREEN}Cleaned up temporary test candidate from database successfully.${RESET}`);
      } catch (dbErr) {
        console.log(`  └─ ${RED}Candidate cleanup error: ${dbErr.message}${RESET}`);
      }
    }
  }

  // Question Banks CRUD
  if (recToken) {
    console.log(`\n${BOLD}[Question Banks CRUD Execution]${RESET}`);
    const tempBankData = {
      name: 'Temp QA Question Bank',
    };

    const createBankRes = await request('POST', '/api/v1/questions/banks', tempBankData, recToken);
    await recordResult('Questions', 'POST', '/api/v1/questions/banks [CREATE TEMP]', createBankRes.status, createBankRes.time, createBankRes.error || createBankRes.data?.message);

    if (createBankRes.ok && createBankRes.data?.data?.bank?.id) {
      const createdBankId = createBankRes.data.data.bank.id;

      // Update Bank
      const updateBankRes = await request('PUT', `/api/v1/questions/banks/${createdBankId}`, { name: 'Temp QA Question Bank (Updated)' }, recToken);
      await recordResult('Questions', 'PUT', '/api/v1/questions/banks/:id [UPDATE TEMP]', updateBankRes.status, updateBankRes.time, updateBankRes.error || updateBankRes.data?.message);

      // Delete Bank
      const deleteBankRes = await request('DELETE', `/api/v1/questions/banks/${createdBankId}`, null, recToken);
      await recordResult('Questions', 'DELETE', '/api/v1/questions/banks/:id [HARD DELETE TEMP]', deleteBankRes.status, deleteBankRes.time, deleteBankRes.error || deleteBankRes.data?.message);
    }
  }

  logSection('6. SYSTEM TESTING REPORT SUMMARY');

  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;

  console.log(`Total Endpoints Tested: ${BOLD}${total}${RESET}`);
  console.log(`Passed:                 ${BOLD}${GREEN}${passed}${RESET}`);
  console.log(`Failed:                 ${BOLD}${failed > 0 ? RED : GREEN}${failed}${RESET}`);

  if (failed > 0) {
    console.log(`\n${BOLD}${RED}FAILED ENDPOINTS DETAILS:${RESET}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(` - [${r.category}] ${BOLD}${r.method}${RESET} ${r.endpoint} (Status: ${r.status}) -> Error: ${r.error || 'N/A'}`);
    });
  } else {
    console.log(`\n${BOLD}${GREEN}ALL TESTED ENDPOINTS ARE FULLY OPERATIONAL AND WORKING PROPERLY! 🎉${RESET}`);
  }

  // Cleanup DB connections
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error('Test Execution failed:', e);
  await prisma.$disconnect();
});
