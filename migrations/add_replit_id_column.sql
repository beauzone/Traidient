-- Add replit_id column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'replit_id'
    ) THEN
        ALTER TABLE users ADD COLUMN replit_id INTEGER UNIQUE;
    END IF;
END $$;