import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ Missing DATABASE_URL in .env file');
}

// Environment-specific pool settings
const isProduction = process.env.NODE_ENV === 'production';
const maxConnections = parseInt(process.env.DB_POOL_MAX || '20', 10);

// Connection pool configuration optimized for different environments
// Production: Higher pool size, longer timeouts
// Development: Lower pool size, shorter timeouts for faster feedback
const sql = postgres(connectionString, {
  // Pool sizing
  max: maxConnections,              // Maximum pool size (env configurable)
 // min: isProduction ? 5 : 1,        // Minimum pool size
  
  // Timeout configuration
  idle_timeout: isProduction ? 30 : 10,     // Close idle connections (seconds)
  connect_timeout: isProduction ? 30 : 10,  // Connection timeout (seconds)
  max_lifetime: 60 * 30,                     // Max connection lifetime (30 minutes)
  
  // Query settings
  fetch_types: true,                // Fetch type information for better parsing
  
  // Transform configuration for consistency
  transform: {
    undefined: null,                // Transform undefined to null
  },
  
  // Connection event handlers for monitoring
  onnotice: () => {},               // Suppress notice messages
  
  // Debug logging in development
  debug: process.env.DB_DEBUG === 'true' ? (connection, query, params) => {
    console.log(`[DB Query] ${query.slice(0, 100)}...`);
  } : undefined,
  
  // SSL configuration for production
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  
  // Prepared statement cache
  prepare: isProduction,
});

// Connection pool monitoring
let activeConnections = 0;
let totalQueries = 0;

// Helper to track pool usage
export function getPoolStats() {
  return {
    activeConnections,
    totalQueries,
    maxConnections,
    isProduction,
  };
}

// Wrapped query function with monitoring
export async function query<T>(
  queryFn: () => Promise<T>,
  label?: string
): Promise<T> {
  const startTime = Date.now();
  activeConnections++;
  totalQueries++;
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    // Log slow queries in production
    if (isProduction && duration > 1000) {
      console.warn(`[Slow Query] ${label || 'Unknown'}: ${duration}ms`);
    }
    
    return result;
  } finally {
    activeConnections--;
  }
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});

export default sql;

