-- IP-NFT Platform Database Schema for Supabase
-- This schema supports tracking IP-NFTs, marketplace transactions, escrow transactions, and analytics

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- IP-NFTs table
CREATE TABLE IF NOT EXISTS ipnfts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_id VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    ip_type VARCHAR(100) NOT NULL,
    creator_address VARCHAR(255) NOT NULL,
    owner_address VARCHAR(255) NOT NULL,
    content_hash VARCHAR(255) NOT NULL,
    metadata_bytes TEXT NOT NULL,
    schema_version VARCHAR(50) DEFAULT '1.0.0',
    external_url TEXT,
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    transaction_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    gas_used VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace transactions table
CREATE TABLE IF NOT EXISTS marketplace_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('listing', 'sale', 'auction_created', 'bid_placed', 'auction_ended')),
    token_id VARCHAR(255) NOT NULL,
    listing_id VARCHAR(255),
    auction_id VARCHAR(255),
    seller_address VARCHAR(255) NOT NULL,
    buyer_address VARCHAR(255),
    price VARCHAR(255) NOT NULL,
    transaction_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    gas_used VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow transactions table
CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    escrow_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('created', 'verification_submitted', 'verification_approved', 'completed', 'disputed', 'resolved')),
    token_id VARCHAR(255) NOT NULL,
    seller_address VARCHAR(255) NOT NULL,
    buyer_address VARCHAR(255) NOT NULL,
    price VARCHAR(255) NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL,
    verification_type VARCHAR(50),
    document_hash VARCHAR(255),
    transaction_hash VARCHAR(255) NOT NULL,
    block_number BIGINT NOT NULL,
    gas_used VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics snapshots table for daily metrics
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_ipnfts INTEGER NOT NULL DEFAULT 0,
    total_marketplace_transactions INTEGER NOT NULL DEFAULT 0,
    total_escrow_transactions INTEGER NOT NULL DEFAULT 0,
    total_volume VARCHAR(255) NOT NULL DEFAULT '0',
    active_listings INTEGER NOT NULL DEFAULT 0,
    active_auctions INTEGER NOT NULL DEFAULT 0,
    active_escrows INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ipnfts_token_id ON ipnfts(token_id);
CREATE INDEX IF NOT EXISTS idx_ipnfts_creator_address ON ipnfts(creator_address);
CREATE INDEX IF NOT EXISTS idx_ipnfts_owner_address ON ipnfts(owner_address);
CREATE INDEX IF NOT EXISTS idx_ipnfts_ip_type ON ipnfts(ip_type);
CREATE INDEX IF NOT EXISTS idx_ipnfts_created_at ON ipnfts(created_at);

CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_token_id ON marketplace_transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_type ON marketplace_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_seller ON marketplace_transactions(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_buyer ON marketplace_transactions(buyer_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_transactions_created_at ON marketplace_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_escrow_id ON escrow_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_token_id ON escrow_transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_type ON escrow_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_seller ON escrow_transactions(seller_address);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_buyer ON escrow_transactions(buyer_address);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_created_at ON escrow_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(date);

-- Create updated_at trigger for ipnfts table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ipnfts_updated_at BEFORE UPDATE ON ipnfts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE ipnfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (you may want to restrict this based on your needs)
CREATE POLICY "Allow public read access on ipnfts" ON ipnfts
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on marketplace_transactions" ON marketplace_transactions
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on escrow_transactions" ON escrow_transactions
    FOR SELECT USING (true);

CREATE POLICY "Allow public read access on analytics_snapshots" ON analytics_snapshots
    FOR SELECT USING (true);

-- Create policies for service role (full access)
CREATE POLICY "Allow service role full access on ipnfts" ON ipnfts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on marketplace_transactions" ON marketplace_transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on escrow_transactions" ON escrow_transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on analytics_snapshots" ON analytics_snapshots
    FOR ALL USING (auth.role() = 'service_role');

-- Views for common queries
CREATE OR REPLACE VIEW active_listings AS
SELECT 
    mt.*,
    i.title,
    i.description,
    i.ip_type,
    i.image_url
FROM marketplace_transactions mt
JOIN ipnfts i ON mt.token_id = i.token_id
WHERE mt.transaction_type = 'listing'
AND NOT EXISTS (
    SELECT 1 FROM marketplace_transactions mt2 
    WHERE mt2.token_id = mt.token_id 
    AND mt2.transaction_type = 'sale' 
    AND mt2.created_at > mt.created_at
);

CREATE OR REPLACE VIEW active_auctions AS
SELECT 
    mt.*,
    i.title,
    i.description,
    i.ip_type,
    i.image_url
FROM marketplace_transactions mt
JOIN ipnfts i ON mt.token_id = i.token_id
WHERE mt.transaction_type = 'auction_created'
AND NOT EXISTS (
    SELECT 1 FROM marketplace_transactions mt2 
    WHERE mt2.auction_id = mt.auction_id 
    AND mt2.transaction_type = 'auction_ended' 
    AND mt2.created_at > mt.created_at
);

CREATE OR REPLACE VIEW active_escrows AS
SELECT 
    et.*,
    i.title,
    i.description,
    i.ip_type,
    i.image_url
FROM escrow_transactions et
JOIN ipnfts i ON et.token_id = i.token_id
WHERE et.transaction_type = 'created'
AND NOT EXISTS (
    SELECT 1 FROM escrow_transactions et2 
    WHERE et2.escrow_id = et.escrow_id 
    AND et2.transaction_type IN ('completed', 'resolved') 
    AND et2.created_at > et.created_at
);

-- Functions for analytics
CREATE OR REPLACE FUNCTION get_daily_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_ipnfts BIGINT,
    total_marketplace_transactions BIGINT,
    total_escrow_transactions BIGINT,
    total_volume NUMERIC,
    active_listings BIGINT,
    active_auctions BIGINT,
    active_escrows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM ipnfts WHERE DATE(created_at) <= target_date) as total_ipnfts,
        (SELECT COUNT(*) FROM marketplace_transactions WHERE DATE(created_at) <= target_date) as total_marketplace_transactions,
        (SELECT COUNT(*) FROM escrow_transactions WHERE DATE(created_at) <= target_date) as total_escrow_transactions,
        (SELECT COALESCE(SUM(price::NUMERIC), 0) FROM marketplace_transactions 
         WHERE transaction_type = 'sale' AND DATE(created_at) <= target_date) as total_volume,
        (SELECT COUNT(*) FROM active_listings) as active_listings,
        (SELECT COUNT(*) FROM active_auctions) as active_auctions,
        (SELECT COUNT(*) FROM active_escrows) as active_escrows;
END;
$$ LANGUAGE plpgsql;

-- Sample data insertion (optional, for testing)
-- You can uncomment these if you want some sample data

/*
-- Sample IP-NFT
INSERT INTO ipnfts (
    token_id, title, description, ip_type, creator_address, owner_address,
    content_hash, metadata_bytes, tags, transaction_hash, block_number, gas_used
) VALUES (
    '1', 
    'Revolutionary AI Algorithm',
    'A breakthrough machine learning algorithm for natural language processing',
    'Patent',
    '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
    '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
    'bafkreicrhuxfzrydht6tmd4kyy6pkbhspqthswg6xbiqlaztmf774ojxhq',
    'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    ARRAY['AI', 'Machine Learning', 'NLP'],
    '0x1234567890abcdef1234567890abcdef12345678',
    1000000,
    '150000'
);

-- Sample marketplace transaction
INSERT INTO marketplace_transactions (
    transaction_type, token_id, listing_id, seller_address, price,
    transaction_hash, block_number, gas_used
) VALUES (
    'listing',
    '1',
    '1',
    '0x742d35Cc6634C0532925a3b8D6Ac6E1e9F1F1234',
    '1.5',
    '0x1234567890abcdef1234567890abcdef12345679',
    1000001,
    '100000'
);
*/

-- Comments for documentation
COMMENT ON TABLE ipnfts IS 'Stores all IP-NFT metadata and blockchain transaction information';
COMMENT ON TABLE marketplace_transactions IS 'Tracks all marketplace activities including listings, sales, and auctions';
COMMENT ON TABLE escrow_transactions IS 'Records all escrow-related transactions and verifications';
COMMENT ON TABLE analytics_snapshots IS 'Daily snapshots of platform metrics for historical analysis';

COMMENT ON COLUMN ipnfts.token_id IS 'Unique token identifier from the smart contract';
COMMENT ON COLUMN ipnfts.content_hash IS 'Hash of the IP content for verification';
COMMENT ON COLUMN ipnfts.metadata_bytes IS 'Raw metadata bytes, usually IPFS hash or JSON';

COMMENT ON COLUMN marketplace_transactions.transaction_type IS 'Type of marketplace transaction: listing, sale, auction_created, bid_placed, auction_ended';
COMMENT ON COLUMN escrow_transactions.transaction_type IS 'Type of escrow transaction: created, verification_submitted, verification_approved, completed, disputed, resolved';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
