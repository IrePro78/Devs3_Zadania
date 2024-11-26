// import { driver, auth } from 'neo4j-driver';
// import * as dotenv from 'dotenv';

// dotenv.config();

// async function main() {
//     console.log('Próba połączenia z Neo4j...');
    
//     const neo4jDriver = driver(
//         'bolt://localhost:7687',
//         auth.basic('neo4j', process.env.NEO4J_PASSWORD || 'neo4j'),
//         {
//             encrypted: false,
//             maxConnectionLifetime: 3 * 60 * 60 * 1000,
//             maxConnectionPoolSize: 50,
//             connectionTimeout: 30000,
//         }
//     );

//     const session = neo4jDriver.session();
//     try {
//         console.log('Próba wykonania zapytania testowego...');
//         const result = await session.run('RETURN "Test connection" as message');
//         console.log('Połączenie udane:', result.records[0].get('message'));
//     } catch (error: any) {
//         console.error('Szczegóły błędu:', {
//             message: error.message,
//             code: error.code,
//             name: error.name
//         });
//         throw error;
//     } finally {
//         await session.close();
//         await neo4jDriver.close();
//     }
// }

// main()
//     .catch(error => {
//         console.error('Błąd główny:', error);
//         process.exit(1);
//     }); 