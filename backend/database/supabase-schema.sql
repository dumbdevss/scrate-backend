-- IP-NFT Platform Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- IP-NFT Collections table
CREATE TABLE ipnft_collections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_id TEXT UNIQUE NOT NULL,
    token_address TEXT NOT NULL,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    total_supply INTEGER DEFAULT 0,
    max_supply INTEGER,
    treasury_account TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IP-NFTs table
CREATE TABLE ipnfts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_id TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    owner_account TEXT NOT NULL,
    metadata JSONB NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    external_url TEXT,
    industry TEXT,
    organization TEXT,
    topic TEXT,
    research_lead_name TEXT,
    research_lead_email TEXT,
    minted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(token_id, serial_number)
);

-- Marketplace Listings table
CREATE TABLE marketplace_listings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    listing_id INTEGER UNIQUE NOT NULL,
    token_id TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    seller_account TEXT NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sold_at TIMESTAMP WITH TIME ZONE,
    buyer_account TEXT,
    transaction_id TEXT
);

-- Marketplace Auctions table
CREATE TABLE marketplace_auctions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id INTEGER UNIQUE NOT NULL,
    token_id TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    seller_account TEXT NOT NULL,
    starting_price DECIMAL(20, 8) NOT NULL,
    current_bid DECIMAL(20, 8) DEFAULT 0,
    current_bidder TEXT,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    winner_account TEXT,
    winning_bid DECIMAL(20, 8),
    transaction_id TEXT
);

-- Auction Bids table
CREATE TABLE auction_bids (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    auction_id INTEGER NOT NULL REFERENCES marketplace_auctions(auction_id),
    bidder_account TEXT NOT NULL,
    bid_amount DECIMAL(20, 8) NOT NULL,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow Agreements table
CREATE TABLE escrows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    escrow_id INTEGER UNIQUE NOT NULL,
    token_id TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    seller_account TEXT NOT NULL,
    buyer_account TEXT NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    escrow_fee DECIMAL(20, 8) NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'seller_verified', 'buyer_verified', 'both_verified', 'completed', 'disputed', 'cancelled', 'refunded')),
    completion_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    transaction_id TEXT
);

-- Escrow Verification Requirements table
CREATE TABLE escrow_verification_requirements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    escrow_id INTEGER NOT NULL REFERENCES escrows(escrow_id),
    requirement_index INTEGER NOT NULL,
    verification_type TEXT NOT NULL,
    description TEXT NOT NULL,
    expected_hash TEXT,
    seller_completed BOOLEAN DEFAULT FALSE,
    buyer_approved BOOLEAN DEFAULT FALSE,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Escrow Evidence table
CREATE TABLE escrow_evidence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    escrow_id INTEGER NOT NULL REFERENCES escrows(escrow_id),
    requirement_index INTEGER NOT NULL,
    submitter_account TEXT NOT NULL,
    evidence_url TEXT NOT NULL,
    document_hash TEXT,
    submission_type TEXT CHECK (submission_type IN ('seller_evidence', 'buyer_comment')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table for tracking all platform activity
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('mint', 'transfer', 'list', 'buy', 'bid', 'auction_end', 'escrow_create', 'escrow_complete')),
    from_account TEXT,
    to_account TEXT,
    token_id TEXT,
    serial_number INTEGER,
    amount DECIMAL(20, 8),
    fee DECIMAL(20, 8),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    block_number BIGINT,
    gas_used BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Analytics table
CREATE TABLE daily_analytics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL,
    transaction_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    volume DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, transaction_type)
);

-- User Accounts table (optional, for tracking user activity)
CREATE TABLE user_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hedera_account_id TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    organization TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- IP-NFT Ownership History table
CREATE TABLE ownership_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_id TEXT NOT NULL,
    serial_number INTEGER NOT NULL,
    from_account TEXT,
    to_account TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    transfer_type TEXT CHECK (transfer_type IN ('mint', 'sale', 'transfer', 'auction')),
    price DECIMAL(20, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_ipnfts_owner ON ipnfts(owner_account);
CREATE INDEX idx_ipnfts_industry ON ipnfts(industry);
CREATE INDEX idx_ipnfts_organization ON ipnfts(organization);
CREATE INDEX idx_ipnfts_minted_at ON ipnfts(minted_at);

CREATE INDEX idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_account);
CREATE INDEX idx_marketplace_listings_created_at ON marketplace_listings(created_at);

CREATE INDEX idx_marketplace_auctions_status ON marketplace_auctions(status);
CREATE INDEX idx_marketplace_auctions_end_time ON marketplace_auctions(end_time);
CREATE INDEX idx_marketplace_auctions_seller ON marketplace_auctions(seller_account);

CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_seller ON escrows(seller_account);
CREATE INDEX idx_escrows_buyer ON escrows(buyer_account);

CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_from_account ON transactions(from_account);
CREATE INDEX idx_transactions_to_account ON transactions(to_account);

CREATE INDEX idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX idx_daily_analytics_type ON daily_analytics(transaction_type);

CREATE INDEX idx_ownership_history_token ON ownership_history(token_id, serial_number);
CREATE INDEX idx_ownership_history_to_account ON ownership_history(to_account);

-- Create views for common queries
CREATE VIEW active_listings AS
SELECT 
    ml.*,
    i.name,
    i.description,
    i.image_url,
    i.industry,
    i.organization
FROM marketplace_listings ml
JOIN ipnfts i ON ml.token_id = i.token_id AND ml.serial_number = i.serial_number
WHERE ml.status = 'active';

CREATE VIEW active_auctions AS
SELECT 
    ma.*,
    i.name,
    i.description,
    i.image_url,
    i.industry,
    i.organization
FROM marketplace_auctions ma
JOIN ipnfts i ON ma.token_id = i.token_id AND ma.serial_number = i.serial_number
WHERE ma.status = 'active' AND ma.end_time > NOW();

CREATE VIEW platform_stats AS
SELECT 
    (SELECT COUNT(*) FROM ipnfts) as total_minted,
    (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active') as active_listings,
    (SELECT COUNT(*) FROM marketplace_auctions WHERE status = 'active') as active_auctions,
    (SELECT COUNT(*) FROM escrows WHERE status IN ('active', 'seller_verified', 'buyer_verified', 'both_verified')) as active_escrows,
    (SELECT COALESCE(SUM(price), 0) FROM marketplace_listings WHERE status = 'sold') as total_sales_volume,
    (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE) as daily_transactions;

-- Enable Row Level Security (RLS) for sensitive tables
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_evidence ENABLE ROW LEVEL SECURITY;

-- Create policies (examples - adjust based on your authentication system)
-- Users can only see their own account data
CREATE POLICY "Users can view own account" ON user_accounts
    FOR SELECT USING (hedera_account_id = current_setting('app.current_user_account', true));

-- Users can only see escrows they're involved in
CREATE POLICY "Users can view own escrows" ON escrows
    FOR SELECT USING (
        seller_account = current_setting('app.current_user_account', true) OR 
        buyer_account = current_setting('app.current_user_account', true)
    );

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_ipnft_collections_updated_at BEFORE UPDATE ON ipnft_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ipnfts_updated_at BEFORE UPDATE ON ipnfts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON marketplace_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketplace_auctions_updated_at BEFORE UPDATE ON marketplace_auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrows_updated_at BEFORE UPDATE ON escrows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_accounts_updated_at BEFORE UPDATE ON user_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
