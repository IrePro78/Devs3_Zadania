import { driver, auth } from 'neo4j-driver';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
  throw new Error("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set");
}

async function testConnection() {
    console.log('Próba połączenia z Neo4j...');
    
    const neo4jDriver = driver(
        process.env.NEO4J_URI!,
        auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),
        {
            encrypted: false,
            maxConnectionLifetime: 3 * 60 * 60 * 1000,
            maxConnectionPoolSize: 50,
            connectionTimeout: 30000,
        }
    );

    const session = neo4jDriver.session();
    try {
        console.log('Próba wykonania zapytania testowego...');
        const result = await session.run('RETURN "Test connection" as message');
        console.log('Połączenie udane:', result.records[0].get('message'));
        await session.close();
        await neo4jDriver.close();
        return true;
    } catch (error: any) {
        console.error('Szczegóły błędu:', {
            message: error.message,
            code: error.code,
            name: error.name
        });
        throw error;
    }
}

async function main() {
    try {
        await testConnection();
        console.log('Możesz teraz rozpocząć pracę z bazą Neo4j');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main(); 