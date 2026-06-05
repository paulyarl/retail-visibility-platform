#!/bin/bash

set -e

echo "🚀 Git Migration: Staging to Production"
echo "======================================="

# Load Doppler environment variables
if command -v doppler &> /dev/null; then
  echo "🔧 Using Doppler for environment variables..."
  eval $(doppler secrets download --format=env --no-file -c local_migration)
fi

echo "📋 Current Git Status:"
echo "===================="

# Show current branch and status
echo "📍 Current branch: $(git branch --show-current)"
echo "📊 Working directory status:"
git status --porcelain

echo ""
echo "📋 Remote Configuration:"
echo "========================"

# Show remotes
echo "🔗 Git remotes:"
git remote -v

echo ""
echo "📋 Migration Strategy:"
echo "===================="

echo "🎯 Strategy 1: Merge staging into main (Recommended)"
echo "   - Merge staging branch into main"
echo "   - Push main to production"
echo "   - Preserves all staging changes"
echo ""

echo "🎯 Strategy 2: Create production branch"
echo "   - Create new production branch from staging"
echo "   - Push production branch"
echo "   - Keeps main as backup"
echo ""

echo "🎯 Strategy 3: Fast-forward main to staging"
echo "   - Fast-forward main to match staging"
echo "   - Simple, clean history"
echo "   - No merge commit needed"
echo ""

# Check if we're ready for migration
echo "📋 Pre-Migration Checks:"
echo "======================="

# Check if staging is ahead of main
staging_ahead=$(git rev-list --count main..staging 2>/dev/null || echo "0")
main_ahead=$(git rev-list --count staging..main 2>/dev/null || echo "0")

echo "📊 Branch comparison:"
echo "   Staging ahead of main: $staging_ahead commits"
echo "   Main ahead of staging: $main_ahead commits"

if [ "$staging_ahead" -gt 0 ]; then
  echo "✅ Staging has changes to merge to production"
else
  echo "⚠️  Staging and main are at same commit"
fi

# Check for uncommitted changes
uncommitted=$(git status --porcelain | wc -l)
if [ "$uncommitted" -gt 0 ]; then
  echo "⚠️  You have $uncommitted uncommitted changes"
  echo "   Consider committing them before migration"
else
  echo "✅ Working directory is clean"
fi

echo ""
echo "📋 Recommended Actions:"
echo "======================"

if [ "$uncommitted" -gt 0 ]; then
  echo "1. Commit migration scripts:"
  echo "   git add scripts/"
  echo "   git commit -m \"Add database migration scripts and exports\""
  echo ""
fi

echo "2. Choose migration strategy:"
echo "   ./06_git_migration.sh merge    # Strategy 1: Merge (Recommended)"
echo "   ./06_git_migration.sh branch   # Strategy 2: New branch"
echo "   ./06_git_migration.sh fast-forward # Strategy 3: Fast-forward"
echo ""

echo "3. After migration:"
echo "   - Update production deployment"
echo "   - Test production application"
echo "   - Update any production-specific configs"

# Handle command line arguments
if [ "$1" = "merge" ]; then
  echo ""
  echo "🚀 Executing Strategy 1: Merge staging into main"
  echo "=============================================="
  
  # Commit any untracked files first
  if [ "$uncommitted" -gt 0 ]; then
    echo "📝 Committing migration files..."
    git add scripts/
    git commit -m "Add database migration scripts and exports"
  fi
  
  echo "🔄 Switching to main branch..."
  git checkout main
  
  echo "🔄 Merging staging into main..."
  git merge staging -m "Merge staging into production"
  
  echo "📤 Pushing to production..."
  git push origin main
  
  echo "✅ Migration complete!"
  echo "📍 Now on branch: $(git branch --show-current)"
  
elif [ "$1" = "branch" ]; then
  echo ""
  echo "🚀 Executing Strategy 2: Create production branch"
  echo "==============================================="
  
  # Commit any untracked files first
  if [ "$uncommitted" -gt 0 ]; then
    echo "📝 Committing migration files..."
    git add scripts/
    git commit -m "Add database migration scripts and exports"
  fi
  
  echo "🌟 Creating production branch from staging..."
  git checkout -b production staging
  
  echo "📤 Pushing production branch..."
  git push origin production
  
  echo "✅ Production branch created!"
  echo "📍 Now on branch: $(git branch --show-current)"
  
elif [ "$1" = "fast-forward" ]; then
  echo ""
  echo "🚀 Executing Strategy 3: Fast-forward main to staging"
  echo "================================================="
  
  # Commit any untracked files first
  if [ "$uncommitted" -gt 0 ]; then
    echo "📝 Committing migration files..."
    git add scripts/
    git commit -m "Add database migration scripts and exports"
  fi
  
  echo "🔄 Switching to main branch..."
  git checkout main
  
  echo "⚡ Fast-forwarding main to staging..."
  git merge --ff-only staging
  
  echo "📤 Pushing to production..."
  git push origin main
  
  echo "✅ Fast-forward complete!"
  echo "📍 Now on branch: $(git branch --show-current)"
  
else
  echo ""
  echo "💡 Usage: $0 [merge|branch|fast-forward]"
  echo "   merge        - Merge staging into main (recommended)"
  echo "   branch       - Create new production branch"
  echo "   fast-forward - Fast-forward main to staging"
fi

echo ""
echo "🎯 Next Steps:"
echo "============"
echo "1. Update production deployment configuration"
echo "2. Test production application with migrated database"
echo "3. Update any environment-specific settings"
echo "4. Monitor production performance"
