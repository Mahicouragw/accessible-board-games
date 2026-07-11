#!/usr/bin/env node
/**
 * Neon Database Branching for Versioning
 * Manage database versions like Git branches
 * 
 * Usage:
 *   NEON_API_KEY=napi_xxx NEON_PROJECT_ID=proj_xxx node scripts/neon-branch.js list
 *   NEON_API_KEY=napi_xxx NEON_PROJECT_ID=proj_xxx node scripts/neon-branch.js create v2-new-games
 *   NEON_API_KEY=napi_xxx NEON_PROJECT_ID=proj_xxx node scripts/neon-branch.js delete branch-id
 * 
 * Get API Key: https://console.neon.tech/app/settings/api-keys
 * Get Project ID: Neon Dashboard URL https://console.neon.tech/app/projects/<project-id>
 */

const API_BASE = 'https://console.neon.tech/api/v2';

async function apiRequest(path, options = {}) {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) {
    console.error('❌ NEON_API_KEY not set');
    console.log('Set: NEON_API_KEY=napi_xxx');
    console.log('Get at: https://console.neon.tech/app/settings/api-keys');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`❌ API Error ${res.status}:`, data);
    process.exit(1);
  }
  return data;
}

async function listBranches() {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    console.error('❌ NEON_PROJECT_ID not set');
    console.log('Find Project ID in Neon Dashboard URL: https://console.neon.tech/app/projects/<project-id>/branches');
    process.exit(1);
  }

  console.log(`📋 Listing branches for project ${projectId}...`);
  const data = await apiRequest(`/projects/${projectId}/branches`);
  
  console.log(`\nFound ${data.branches?.length || 0} branches:\n`);
  data.branches?.forEach(b => {
    console.log(`- ${b.name} (ID: ${b.id}) - Created: ${b.created_at} - Parent: ${b.parent_id || 'none (root)'}`);
    if (b.endpoints?.[0]) {
      console.log(`  Connection: postgresql://...@${b.endpoints[0].host}/${b.endpoints[0].database}`);
    }
  });
}

async function createBranch(name) {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    console.error('❌ NEON_PROJECT_ID not set');
    process.exit(1);
  }
  if (!name) {
    console.error('❌ Branch name required: node scripts/neon-branch.js create <branch-name>');
    process.exit(1);
  }

  console.log(`🌿 Creating branch "${name}" from main...`);
  
  // First get main branch ID
  const branchesData = await apiRequest(`/projects/${projectId}/branches`);
  const mainBranch = branchesData.branches?.find(b => b.name === 'main' || !b.parent_id) || branchesData.branches?.[0];
  
  if (!mainBranch) {
    console.error('❌ No main branch found');
    process.exit(1);
  }

  const data = await apiRequest(`/projects/${projectId}/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: {
        name,
        parent_id: mainBranch.id,
      },
    }),
  });

  console.log(`✅ Created branch "${name}"`);
  console.log(`ID: ${data.branch?.id}`);
  console.log(`Connection: Use Neon dashboard to get connection string for this branch`);
  console.log(`\nThis branch is a version of your DB - you can test new features here without breaking main`);
}

async function deleteBranch(branchId) {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId || !branchId) {
    console.error('Usage: node scripts/neon-branch.js delete <branch-id>');
    process.exit(1);
  }

  console.log(`🗑️ Deleting branch ${branchId}...`);
  await apiRequest(`/projects/${projectId}/branches/${branchId}`, {
    method: 'DELETE',
  });
  console.log(`✅ Deleted branch ${branchId}`);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'list':
      await listBranches();
      break;
    case 'create':
      await createBranch(process.argv[3]);
      break;
    case 'delete':
      await deleteBranch(process.argv[3]);
      break;
    default:
      console.log(`
Neon Database Branching - Version Management

Usage:
  NEON_API_KEY=... NEON_PROJECT_ID=... node scripts/neon-branch.js list
  NEON_API_KEY=... NEON_PROJECT_ID=... node scripts/neon-branch.js create <name>
  NEON_API_KEY=... NEON_PROJECT_ID=... node scripts/neon-branch.js delete <branch-id>

Examples:
  # List all DB versions/branches
  NEON_API_KEY=napi_xxx NEON_PROJECT_ID=proj_xxx node scripts/neon-branch.js list

  # Create v2 branch for testing new games
  NEON_API_KEY=napi_xxx NEON_PROJECT_ID=proj_xxx node scripts/neon-branch.js create v2-new-games

  # Each branch has its own DATABASE_URL - use it for testing:
  # DATABASE_URL for v2 branch will be different from main

Get API Key: https://console.neon.tech/app/settings/api-keys
Get Project ID: From Neon dashboard URL https://console.neon.tech/app/projects/<project-id>
      `);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
