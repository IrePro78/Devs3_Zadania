import { driver, auth } from 'neo4j-driver';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

interface User {
    id: string;
    username: string;
    access_level: string;
    is_active: string;
    lastlog: string;
}

interface Connection {
    user1_id: string;
    user2_id: string;
}

async function findShortestPath(session: any, startUser: string, endUser: string) {
    console.log(`\nSzukam najkrótszej ścieżki od ${startUser} do ${endUser}...`);
    
    const result = await session.run(
        `
        MATCH (start:User {username: $startUser}),
              (end:User {username: $endUser}),
              path = shortestPath((start)-[:KNOWS*]-(end))
        RETURN [node in nodes(path) | node.username] as users,
               length(path) as pathLength
        `,
        { startUser, endUser }
    );

    if (result.records.length === 0) {
        console.log(`Nie znaleziono ścieżki między ${startUser} a ${endUser}`);
        return;
    }

    const record = result.records[0];
    const users = record.get('users');
    const pathLength = record.get('pathLength');

    console.log(`\nZnaleziona ścieżka (długość: ${pathLength}):`);
    console.log(users.join(' -> '));
}

async function loadData() {
    const neo4jDriver = driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        auth.basic(
            process.env.NEO4J_USER || 'neo4j',
            process.env.NEO4J_PASSWORD || 'mypassword123'
        ),
        { encrypted: false }
    );

    const session = neo4jDriver.session();

    try {
        // Sprawdzamy czy pliki istnieją
        console.log('Sprawdzanie plików...');
        const usersPath = path.join(__dirname, 'users.json');
        const connectionsPath = path.join(__dirname, 'connections.json');
        
        console.log('Ścieżka do users.json:', usersPath);
        console.log('Ścieżka do connections.json:', connectionsPath);
        
        if (!fs.existsSync(usersPath)) {
            throw new Error(`Brak pliku users.json pod ścieżką: ${usersPath}`);
        }

        // Wczytanie i parsowanie użytkowników
        console.log('Wczytywanie użytkowników...');
        const usersContent = fs.readFileSync(usersPath, 'utf-8');
        
        let usersData: User[];
        try {
            const parsedData = JSON.parse(usersContent) as Record<string, User[]> | User[];
            usersData = Array.isArray(parsedData) ? parsedData : Object.values(parsedData)[0];
            console.log(`Wczytano ${usersData.length} użytkowników`);
        } catch (parseError) {
            console.error('Błąd parsowania JSON (users):', parseError);
            throw parseError;
        }

        // Czyszczenie bazy
        console.log('Czyszczenie bazy...');
        await session.run('MATCH (n) DETACH DELETE n');
        
        // Tworzenie użytkowników w bazie
        console.log('Tworzenie węzłów użytkowników...');
        for (const user of usersData) {
            if (!user.id || !user.username) {
                console.warn('Pominięto nieprawidłowego użytkownika:', user);
                continue;
            }

            const params = {
                id: user.id.toString(),
                username: user.username,
                access_level: user.access_level || 'user',
                is_active: user.is_active || '0',
                lastlog: user.lastlog || ''
            };
            
            console.log('Dodawanie użytkownika:', params);
            
            await session.run(
                `
                CREATE (u:User {
                    id: $id,
                    username: $username,
                    access_level: $access_level,
                    is_active: $is_active,
                    lastlog: $lastlog
                })
                `,
                params
            );
        }

        // Tworzenie indeksu na ID użytkownika
        console.log('Tworzenie indeksu...');
        await session.run('CREATE INDEX user_id IF NOT EXISTS FOR (u:User) ON (u.id)');

        // Wczytanie i parsowanie połączeń
        console.log('Wczytywanie połączeń...');
        if (fs.existsSync(connectionsPath)) {
            const connectionsContent = fs.readFileSync(connectionsPath, 'utf-8');
            let connectionsData: Connection[];
            
            try {
                const parsedConnections = JSON.parse(connectionsContent) as Record<string, Connection[]> | Connection[];
                connectionsData = Array.isArray(parsedConnections) ? parsedConnections : Object.values(parsedConnections)[0];
                console.log(`Wczytano ${connectionsData.length} połączeń`);

                // Tworzenie relacji
                console.log('Tworzenie relacji między użytkownikami...');
                for (const conn of connectionsData) {
                    if (!conn.user1_id || !conn.user2_id) {
                        console.warn('Pominięto nieprawidłowe połączenie:', conn);
                        continue;
                    }

                    await session.run(
                        `
                        MATCH (user1:User {id: $user1Id})
                        MATCH (user2:User {id: $user2Id})
                        CREATE (user1)-[:KNOWS]->(user2)
                        `,
                        { 
                            user1Id: conn.user1_id.toString(), 
                            user2Id: conn.user2_id.toString() 
                        }
                    );
                }
            } catch (parseError) {
                console.error('Błąd parsowania JSON (connections):', parseError);
                throw parseError;
            }
        } else {
            console.log('Plik connections.json nie istnieje - pomijam tworzenie relacji');
        }

        // Statystyki
        const userCount = await session.run('MATCH (u:User) RETURN count(u) as count');
        const connectionCount = await session.run('MATCH ()-[r:KNOWS]->() RETURN count(r) as count');

        console.log(`
            Import zakończony:
            - Liczba użytkowników: ${userCount.records[0].get('count')}
            - Liczba połączeń: ${connectionCount.records[0].get('count')}
        `);

        // Po załadowaniu danych i utworzeniu relacji, wykonaj zapytanie o najkrótszą ścieżkę
        try {
            await findShortestPath(session, 'Rafał', 'Barbara');
        } catch (error) {
            console.error('Błąd podczas szukania ścieżki:', error);
        }

    } catch (error) {
        console.error('Błąd podczas importu:', error);
        if (error instanceof Error) {
            console.error('Szczegóły błędu:', error.message);
            console.error('Stack:', error.stack);
        }
    } finally {
        await session.close();
        await neo4jDriver.close();
    }
}

loadData(); 