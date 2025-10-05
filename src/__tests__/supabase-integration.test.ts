import { supabase, TABLES } from '../lib/supabase';

describe('Supabase Integration Tests', () => {
  it('should connect to Supabase successfully', async () => {
    // Test basic connection by querying a simple table
    const { data, error } = await supabase
      .from(TABLES.SYNC_STATUS)
      .select('*')
      .limit(1);

    // Should not have an error (even if table is empty)
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have all required tables defined', () => {
    const requiredTables = [
      'USERS',
      'PLAYERS', 
      'AGENCY_PLAYERS',
      'CLUBS',
      'MATCHES',
      'PLAYER_SALE_HISTORY',
      'PLAYER_PROGRESSION',
      'SQUAD_IDS',
      'SYNC_STATUS',
      'MATCH_FORMATIONS',
      'COMPETITIONS',
      'TEAM_STATISTICS',
      'PLAYER_RATINGS',
      'MARKET_VALUES',
      'TRANSFER_HISTORY',
      'SEASONS',
      'LEAGUE_STANDINGS'
    ];

    requiredTables.forEach(table => {
      expect(TABLES[table as keyof typeof TABLES]).toBeDefined();
    });
  });

  it('should be able to insert and query sync status', async () => {
    const testData = {
      data_type: 'test_sync',
      status: 'completed',
      progress_percentage: 100,
      last_synced: new Date().toISOString(),
      error_message: null
    };

    // Insert test data
    const { error: insertError } = await supabase
      .from(TABLES.SYNC_STATUS)
      .insert(testData);

    expect(insertError).toBeNull();

    // Query the data back
    const { data, error: selectError } = await supabase
      .from(TABLES.SYNC_STATUS)
      .select('*')
      .eq('data_type', 'test_sync')
      .single();

    expect(selectError).toBeNull();
    expect(data).toBeDefined();
    expect(data.data_type).toBe('test_sync');
    expect(data.status).toBe('completed');

    // Clean up test data
    await supabase
      .from(TABLES.SYNC_STATUS)
      .delete()
      .eq('data_type', 'test_sync');
  });
});

