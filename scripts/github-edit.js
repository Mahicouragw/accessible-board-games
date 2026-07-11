#!/usr/bin/env node
/**
 * GitHub Edit/Delete for accessible-board-games repo only
 * Uses fine-grained PAT or classic PAT with repo scope
 * 
 * Usage:
 *   GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js list
 *   GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js delete path/to/file.zip
 *   GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js upload local-file.txt remote/path.txt
 */

const REPO_OWNER = 'Mahicouragw';
const REPO_NAME = 'accessible-board-games';
const API_BASE = 'https://api.github.com';

async function apiRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('❌ GITHUB_TOKEN not set');
    console.log('Create token: https://github.com/settings/tokens?type=beta (only accessible-board-games repo)');
    process.exit(1);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
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

async function listFiles() {
  console.log(`📋 Listing files in ${REPO_OWNER}/${REPO_NAME}...`);
  const data = await apiRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents`);
  data.forEach(item => {
    console.log(`${item.type === 'dir' ? '📁' : '📄'} ${item.name} (${item.size || 0} bytes) - ${item.path}`);
  });
}

async function deleteFile(filePath) {
  if (!filePath) {
    console.error('Usage: node scripts/github-edit.js delete <file-path>');
    process.exit(1);
  }

  console.log(`🗑️ Deleting ${filePath}...`);
  // First get file SHA
  const fileData = await apiRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
  await apiRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: `Delete ${filePath} via script`,
      sha: fileData.sha,
    }),
  });
  console.log(`✅ Deleted ${filePath}`);
}

async function uploadFile(localPath, remotePath) {
  if (!localPath || !remotePath) {
    console.error('Usage: node scripts/github-edit.js upload <local-file> <remote-path>');
    process.exit(1);
  }

  const fs = require('fs');
  if (!fs.existsSync(localPath)) {
    console.error(`❌ Local file not found: ${localPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(localPath);
  const base64Content = content.toString('base64');

  // Check if file exists to get SHA for update
  let sha;
  try {
    const existing = await apiRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${remotePath}`);
    sha = existing.sha;
  } catch {}

  console.log(`📤 Uploading ${localPath} -> ${remotePath}...`);
  await apiRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${remotePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Upload ${remotePath} via script`,
      content: base64Content,
      sha,
    }),
  });
  console.log(`✅ Uploaded ${remotePath}`);
}

async function main() {
  const cmd = process.argv[2];
  switch (cmd) {
    case 'list':
      await listFiles();
      break;
    case 'delete':
      await deleteFile(process.argv[3]);
      break;
    case 'upload':
      await uploadFile(process.argv[3], process.argv[4]);
      break;
    default:
      console.log(`
GitHub Edit/Delete for ${REPO_OWNER}/${REPO_NAME}

Usage:
  GITHUB_TOKEN=... node scripts/github-edit.js list
  GITHUB_TOKEN=... node scripts/github-edit.js delete <file-path>
  GITHUB_TOKEN=... node scripts/github-edit.js upload <local-file> <remote-path>

Examples:
  # List files
  GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js list

  # Delete old ZIP that causes Vercel 404
  GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js delete accessible-board-games-fixed.zip

  # Upload fixed file
  GITHUB_TOKEN=github_pat_xxx node scripts/github-edit.js upload ./src/app/page.tsx src/app/page.tsx

Create token (only this repo):
https://github.com/settings/tokens?type=beta -> Only select repositories -> Mahicouragw/accessible-board-games -> Contents: Read and write
      `);
  }
}

main().catch(console.error);
