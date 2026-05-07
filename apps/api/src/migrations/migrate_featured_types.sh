#!/bin/bash

# Featured Types Migration Script
# This script handles the migration of featured types from 5 to 10 types

set -e  # Exit on any error

# Configuration
DB_NAME="${DB_NAME:-your_database}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
MIGRATION_DIR="$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check database connection
check_db_connection() {
    print_status "Checking database connection..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        print_status "Database connection successful"
    else
        print_error "Cannot connect to database. Please check your connection parameters."
        exit 1
    fi
}

# Function to backup database
backup_database() {
    local backup_file="featured_types_backup_$(date +%Y%m%d_%H%M%S).sql"
    print_status "Creating database backup: $backup_file"
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$backup_file"
    print_status "Backup created successfully"
}

# Function to run migration test
run_test() {
    print_status "Running migration test..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_DIR/test_migration.sql"
    print_status "Migration test completed"
}

# Function to run migration
run_migration() {
    print_status "Applying featured types migration..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_DIR/add_new_featured_types.sql"
    print_status "Migration applied successfully"
}

# Function to verify migration
verify_migration() {
    print_status "Verifying migration..."
    local result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) 
        FROM pg_constraint 
        WHERE conrelid = 'public.featured_products'::regclass 
          AND conname = 'featured_products_featured_type_check'
          AND pg_get_constraintdef(oid) LIKE '%bestseller%';
    ")
    
    if [ "$result" -eq 1 ]; then
        print_status "Migration verification successful - new types detected"
    else
        print_warning "Migration verification - checking if constraint exists..."
        local constraint_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) 
            FROM pg_constraint 
            WHERE conrelid = 'public.featured_products'::regclass 
              AND conname = 'featured_products_featured_type_check';
        ")
        
        if [ "$constraint_exists" -eq 1 ]; then
            print_status "Constraint exists but may not include new types - checking current types..."
            show_current_types
        else
            print_error "Constraint not found - migration may have failed"
            exit 1
        fi
    fi
}

# Function to show current types
show_current_types() {
    print_status "Current featured types in database:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT pg_get_constraintdef(oid) as allowed_types
        FROM pg_constraint 
        WHERE conrelid = 'public.featured_products'::regclass 
          AND conname = 'featured_products_featured_type_check';
    "
}

# Main execution
main() {
    echo "=== Featured Types Migration Script ==="
    echo "Database: $DB_NAME"
    echo "Host: $DB_HOST:$DB_PORT"
    echo "User: $DB_USER"
    echo "======================================"
    
    # Check if user wants to proceed
    echo
    read -p "Do you want to proceed with the migration? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Migration cancelled by user"
        exit 0
    fi
    
    # Execute migration steps
    check_db_connection
    backup_database
    run_migration
    verify_migration
    show_current_types
    
    print_status "Migration completed successfully!"
    print_warning "Remember to update the frontend code to use the new types"
    print_warning "See README_featured_types_migration.md for next steps"
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0 [test|migrate|rollback|verify|help]"
        echo "  test     - Run migration test without applying changes"
        echo "  migrate  - Apply the migration (default)"
        echo "  rollback - Rollback the migration"
        echo "  verify   - Show current featured types"
        echo "  help     - Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  DB_NAME - Database name (default: your_database)"
        echo "  DB_HOST - Database host (default: localhost)"
        echo "  DB_PORT - Database port (default: 5432)"
        echo "  DB_USER - Database user (default: postgres)"
        ;;
    "test")
        check_db_connection
        run_test
        ;;
    "migrate"|"")
        check_db_connection
        backup_database
        run_migration
        verify_migration
        show_current_types
        print_status "Migration completed successfully!"
        print_warning "Remember to update the frontend code to use the new types"
        print_warning "See README_featured_types_migration.md for next steps"
        ;;
    "rollback")
        print_status "Rolling back featured types migration..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_DIR/rollback_new_featured_types.sql"
        print_status "Rollback completed"
        ;;
    "verify")
        show_current_types
        ;;
esac
