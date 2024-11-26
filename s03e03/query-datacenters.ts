import dotenv from "dotenv";

dotenv.config();

async function queryDatacenters() {
  try {
    const response = await fetch('https://centrala.ag3nts.org/apidb', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        task: "database",
        apikey: process.env.API_KEY,
        query: "SELECT DISTINCT d.dc_id FROM datacenters d JOIN users u ON d.manager = u.id WHERE d.is_active = 1 AND u.is_active = 0"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Aktywne datacenter z managerami na urlopie:", data);
    return data;

  } catch (error) {
    console.error("Błąd podczas wykonywania zapytania:", error);
    throw error;
  }
}

// Uruchom zapytanie
queryDatacenters()
  .catch(console.error)
  .finally(() => process.exit(0)); 