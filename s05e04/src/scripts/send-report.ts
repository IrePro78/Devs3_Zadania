async function sendReport(): Promise<void> {
  try {
    const response = await fetch('https://centrala.ag3nts.org/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: 'serce',
        apikey: '9ce91d39-cedd-40fa-add8-cfa5db47b5ab',
        answer: 'https://azyl-50013.ag3nts.org/heart',
        "justUpdate": true
      })
    });
    
    const data = await response.json();
    console.log('Raport wysłany pomyślnie');
    console.log('Odpowiedź:', data);
  } catch (error) {
    console.error('Błąd podczas wysyłania raportu:', error.message);
  }
}

sendReport(); 