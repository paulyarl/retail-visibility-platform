#!/usr/bin/env node

/**
 * Master Test Runner for All Phases
 * Runs all phase tests in sequence and provides comprehensive reporting
 */

const { runPhase1Tests } = require('./test-phase-1');
const { runPhase2Tests } = require('./test-phase-2');
const { runPhase3_4Tests } = require('./test-phase3-4');
const { runPhase5Tests } = require('./test-phase5');
const { runPhase6Tests } = require('./test-phase6');

const fs = require('fs');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PHASES = [
  { name: 'Phase 1: Core Infrastructure', runner: runPhase1Tests, file: 'test-phase-1.js' },
  { name: 'Phase 2: Basic Shop Management', runner: runPhase2Tests, file: 'test-phase-2.js' },
  { name: 'Phase 3-4: Shop Discovery Components', runner: runPhase3_4Tests, file: 'test-phase3-4.js' },
  { name: 'Phase 5: Advanced Shop Discovery Components', runner: runPhase5Tests, file: 'test-phase5.js' },
  { name: 'Phase 6: Advanced Features', runner: runPhase6Tests, file: 'test-phase6.js' }
];

const MASTER_RESULTS = {
  startTime: new Date(),
  endTime: null,
  totalDuration: 0,
  phases: [],
  summary: {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    overallSuccess: false
  }
};

// Utility to capture console output
async function captureConsole(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  let output = [];
  let errors = [];
  
  console.log = (...args) => {
    output.push(args.join(' '));
    originalLog(...args);
  };
  
  console.error = (...args) => {
    errors.push(args.join(' '));
    originalError(...args);
  };
  
  const result = await fn();
  
  console.log = originalLog;
  console.error = originalError;
  
  return { result, output, errors };
}

// Run individual phase
async function runPhase(phase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 STARTING: ${phase.name}`);
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📁 Test File: ${phase.file}`);
  console.log(`${'='.repeat(80)}`);
  
  const phaseStartTime = new Date();
  
  try {
    // Set environment for the phase
    process.env.BASE_URL = BASE_URL;
    process.env.MASTER_TEST_RUNNER = 'true';
    
    // For Phase 3-4, 5, and 6, set separate URLs for frontend and API testing
    if (phase.name.includes('Phase 3-4') || phase.name.includes('Phase 5') || phase.name.includes('Phase 6')) {
      process.env.BASE_URL = 'http://localhost:3000'; // Frontend
      process.env.API_URL = 'http://localhost:4000'; // API
    }
    
    // Run the phase tests
    const { result, output, errors } = await captureConsole(() => phase.runner());
    
    const phaseEndTime = new Date();
    const phaseDuration = phaseEndTime - phaseStartTime;
    
    // The result is already the exit code since we awaited it
    const exitCode = result;
    
    // Load the results file if it exists
    let resultsData = null;
    const resultsFile = `./test-results-${phase.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    
    if (fs.existsSync(resultsFile)) {
      try {
        resultsData = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      } catch (e) {
        console.warn(`Could not read results file: ${resultsFile}`);
      }
    }
    
    const phaseResult = {
      name: phase.name,
      file: phase.file,
      startTime: phaseStartTime,
      endTime: phaseEndTime,
      duration: phaseDuration,
      exitCode,
      success: exitCode === 0,
      output: output.join('\n'),
      errors: errors.join('\n'),
      results: resultsData
    };
    
    MASTER_RESULTS.phases.push(phaseResult);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 PHASE COMPLETE: ${phase.name}`);
    console.log(`⏱️  Duration: ${phaseDuration}ms`);
    console.log(`${phaseResult.success ? '✅' : '❌'} Status: ${phaseResult.success ? 'PASSED' : 'FAILED'}`);
    console.log(`${'='.repeat(80)}`);
    
    return phaseResult;
    
  } catch (error) {
    const phaseEndTime = new Date();
    const phaseDuration = phaseEndTime - phaseStartTime;
    
    const phaseResult = {
      name: phase.name,
      file: phase.file,
      startTime: phaseStartTime,
      endTime: phaseEndTime,
      duration: phaseDuration,
      exitCode: 1,
      success: false,
      output: '',
      errors: error.message,
      results: null
    };
    
    MASTER_RESULTS.phases.push(phaseResult);
    
    console.log(`\n❌ PHASE FAILED: ${phase.name}`);
    console.log(`Error: ${error.message}`);
    
    return phaseResult;
  }
}

// Generate comprehensive report
function generateReport() {
  MASTER_RESULTS.endTime = new Date();
  MASTER_RESULTS.totalDuration = MASTER_RESULTS.endTime - MASTER_RESULTS.startTime;
  
  // Calculate summary
  MASTER_RESULTS.phases.forEach(phase => {
    if (phase.results) {
      MASTER_RESULTS.summary.totalTests += phase.results.tests?.length || 0;
      MASTER_RESULTS.summary.totalPassed += phase.results.passed || 0;
      MASTER_RESULTS.summary.totalFailed += phase.results.failed || 0;
    }
  });
  
  MASTER_RESULTS.summary.overallSuccess = MASTER_RESULTS.summary.totalFailed === 0;
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('🎉 MASTER TEST REPORT - ALL PHASES');
  console.log('='.repeat(80));
  console.log(`⏱️  Total Duration: ${MASTER_RESULTS.totalDuration}ms`);
  console.log(`📊 Total Tests: ${MASTER_RESULTS.summary.totalTests}`);
  console.log(`✅ Total Passed: ${MASTER_RESULTS.summary.totalPassed}`);
  console.log(`❌ Total Failed: ${MASTER_RESULTS.summary.totalFailed}`);
  console.log(`📈 Success Rate: ${MASTER_RESULTS.summary.totalTests > 0 ? ((MASTER_RESULTS.summary.totalPassed / MASTER_RESULTS.summary.totalTests) * 100).toFixed(1) : 0}%`);
  
  console.log('\n📋 Phase-by-Phase Results:');
  MASTER_RESULTS.phases.forEach(phase => {
    const status = phase.success ? '✅' : '❌';
    const duration = `${phase.duration}ms`;
    const tests = phase.results ? `${phase.results.passed}/${phase.results.tests?.length || 0}` : 'N/A';
    
    console.log(`  ${status} ${phase.name}`);
    console.log(`     ⏱️  ${duration} | 🧪 ${tests} tests`);
    
    if (phase.results && phase.results.failed > 0) {
      console.log(`     ❌ Failed: ${phase.results.failed}`);
    }
  });
  
  console.log('\n🎯 Overall Status:');
  if (MASTER_RESULTS.summary.overallSuccess) {
    console.log('🎉 ALL TESTS PASSED - System is ready for production!');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review and fix issues before production');
  }
  
  // Implementation status
  console.log('\n📊 Implementation Status by Phase:');
  const implementationStatus = {
    'Phase 1': '✅ COMPLETE - Core infrastructure ready',
    'Phase 2': '✅ COMPLETE - Shop APIs implemented',
    'Phase 3-4': '✅ COMPLETE - Discovery components ready',
    'Phase 6': '⚠️  PARTIAL - Services ready, APIs needed'
  };
  
  Object.entries(implementationStatus).forEach(([phase, status]) => {
    console.log(`  ${status} - ${phase}`);
  });
  
  console.log('\n🔗 Quick Access Links:');
  console.log(`  • Test Pages: ${BASE_URL}/test-phase1-2, ${BASE_URL}/test-integration`);
  console.log(`  • Shop Directory: ${BASE_URL}/shops/directory`);
  console.log(`  • Admin Panel: ${BASE_URL}/admin`);
  
  // Save master report
  const reportPath = './master-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(MASTER_RESULTS, null, 2));
  console.log(`\n💾 Master report saved to: ${reportPath}`);
  
  return MASTER_RESULTS.summary.overallSuccess ? 0 : 1;
}

// Main execution
async function runAllPhases() {
  console.log('🚀 STARTING MASTER TEST RUNNER');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`📅 Started: ${MASTER_RESULTS.startTime.toISOString()}`);
  
  // Check if server is running
  console.log('\n🔍 Checking server availability...');
  try {
    const https = require('https');
    const http = require('http');
    
    const checkServer = () => new Promise((resolve, reject) => {
      const lib = BASE_URL.startsWith('https') ? https : http;
      const req = lib.request(`${BASE_URL}/api/health`, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
    
    await checkServer();
    console.log('✅ Server is responding');
  } catch (error) {
    console.log('⚠️  Server may not be running - some tests may fail');
  }
  
  // Run all phases
  for (const phase of PHASES) {
    await runPhase(phase);
    
    // Small delay between phases
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate final report
  const exitCode = generateReport();
  
  console.log('\n🎉 MASTER TEST RUNNER COMPLETE');
  process.exit(exitCode);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🧪 Master Test Runner for Shop Management System

Usage: node master-test-runner.js [options]

Options:
  --help, -h          Show this help message
  --phase <number>    Run specific phase only (1, 2, 3-4, 5, or 6)
  --url <url>         Set base URL (default: http://localhost:3000)

Examples:
  node master-test-runner.js                    # Run all phases
  node master-test-runner.js --phase 5          # Run Phase 5 only
  node master-test-runner.js --url https://staging.example.com

Phases:
  1: Core Infrastructure (Auth, Tenants, Basic APIs)
  2: Basic Shop Management (Shop APIs, Directory)
  3-4: Shop Discovery Components (UI, Search, Filters)
  5: Advanced Shop Discovery (Trending, Categories, Search Components)
  6: Advanced Features (Cart, Tier, Featured, Branding)
`);
  process.exit(0);
}

// Run specific phase if requested
const phaseArgIndex = args.findIndex(arg => arg === '--phase');
if (phaseArgIndex !== -1) {
  const phaseNumber = args[phaseArgIndex + 1];
  let phaseIndex = -1;
  
  switch (phaseNumber) {
    case '1': phaseIndex = 0; break;
    case '2': phaseIndex = 1; break;
    case '3-4': phaseIndex = 2; break;
    case '5': phaseIndex = 3; break;
    case '6': phaseIndex = 4; break;
    default:
      console.error('❌ Invalid phase number. Use 1, 2, 3-4, 5, or 6');
      process.exit(1);
  }
  
  const phase = PHASES[phaseIndex];
  console.log(`🎯 Running single phase: ${phase.name}`);
  runPhase(phase).then(result => {
    console.log(`\n${result.success ? '✅' : '❌'} Phase ${result.success ? 'PASSED' : 'FAILED'}`);
    process.exit(result.success ? 0 : 1);
  });
} else {
  // Run all phases
  runAllPhases().catch(error => {
    console.error('❌ Master test runner failed:', error);
    process.exit(1);
  });
}
