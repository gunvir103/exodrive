#!/usr/bin/env bun

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MIGRATION_PATTERNS = [
  {
    // Browser client migrations
    pattern: /const\s+supabase\s*=\s*getSupabaseBrowserClient\(\)/g,
    replacement: 'const { client: supabase, release } = await getPooledSupabaseClient()',
    requiresAsync: true,
    requiresRelease: true,
  },
  {
    // Service client migrations
    pattern: /const\s+supabase\s*=\s*getSupabaseServiceClient\(\)/g,
    replacement: 'const { client: supabase, release } = await getPooledSupabaseServiceClient()',
    requiresAsync: true,
    requiresRelease: true,
  },
  {
    // Server client migrations
    pattern: /const\s+supabase\s*=\s*createSupabaseServerClient\((.*?)\)/g,
    replacement: 'const { client: supabase, release } = await getPooledSupabaseServerClient($1)',
    requiresAsync: true,
    requiresRelease: true,
  },
];

async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and .next directories
      if (entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      
      files.push(...await findTypeScriptFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function migrateFile(filePath: string, dryRun: boolean = true): Promise<boolean> {
  const content = await readFile(filePath, 'utf-8');
  let newContent = content;
  let hasChanges = false;
  let requiresRelease = false;
  
  for (const migration of MIGRATION_PATTERNS) {
    if (migration.pattern.test(content)) {
      hasChanges = true;
      newContent = newContent.replace(migration.pattern, migration.replacement);
      
      if (migration.requiresRelease) {
        requiresRelease = true;
      }
    }
  }
  
  // Add release calls in finally blocks if needed
  if (requiresRelease && hasChanges) {
    // This is a simplified version - in practice, you'd need more sophisticated AST manipulation
    console.log(`⚠️  ${filePath} requires manual addition of release() calls in finally blocks`);
  }
  
  if (hasChanges) {
    console.log(`📝 ${dryRun ? 'Would update' : 'Updating'}: ${filePath}`);
    
    if (!dryRun) {
      await writeFile(filePath, newContent, 'utf-8');
    }
    
    return true;
  }
  
  return false;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const targetDir = process.argv[2] || process.cwd();
  
  console.log(`🔍 Scanning for TypeScript files in: ${targetDir}`);
  console.log(`📋 Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  console.log('');
  
  const files = await findTypeScriptFiles(targetDir);
  console.log(`Found ${files.length} TypeScript files`);
  console.log('');
  
  let updatedCount = 0;
  
  for (const file of files) {
    const wasUpdated = await migrateFile(file, dryRun);
    if (wasUpdated) {
      updatedCount++;
    }
  }
  
  console.log('');
  console.log(`✅ ${dryRun ? 'Would update' : 'Updated'} ${updatedCount} files`);
  
  if (dryRun) {
    console.log('');
    console.log('To apply changes, run:');
    console.log('  bun run scripts/migrate-to-pooled-connections.ts --apply');
  }
  
  console.log('');
  console.log('⚠️  Important: After migration, you must:');
  console.log('1. Add proper error handling and finally blocks to release connections');
  console.log('2. Test thoroughly to ensure connections are being released properly');
  console.log('3. Monitor connection pool metrics to verify proper operation');
}

main().catch(console.error);