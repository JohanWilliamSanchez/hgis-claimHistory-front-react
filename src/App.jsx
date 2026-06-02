import React, { useState } from 'react';

function App() {
  // Cambiar esta URL por el Output de tu API Gateway desplegada
  const API_BASE_URL = import.meta.env.VITE_API_URL || "https://TU_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/Prod";

  const [claimData, setClaimData] = useState({
    policyNumber: '',
    description: '',
    plateNumber: ''
  });
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClaimData({ ...claimData, [name]: value });
  };

  const registrarSiniestro = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/claims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(claimData)
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      setResponse({ error: "No se pudo conectar con el API Gateway", details: error.message });
    } finally {
      setLoading(false);
    }
  };

  const generarPdf = async (claimId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/documents/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId })
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      setResponse({ error: "Error al solicitar PDF", details: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Aseguradora Colombiana - Registro de Siniestros (Módulo Terreno)</h2>
      <p style={{ fontSize: '12px', color: '#666' }}>Entorno Protegido - Cumplimiento SFC (PII Data)</p>
      
      <form onSubmit={registrarSiniestro} style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
        <h3>Reportar Nuevo Siniestro</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>Número de Póliza: </label>
          <input type="text" name="policyNumber" value={claimData.policyNumber} onChange={handleInputChange} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Placa del Vehículo: </label>
          <input type="text" name="plateNumber" value={claimData.plateNumber} onChange={handleInputChange} required style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Descripción del Incidente: </label>
          <textarea name="description" value={claimData.description} onChange={handleInputChange} required style={{ width: '100%', height: '60px' }} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
          {loading ? 'Procesando...' : 'Registrar Siniestro'}
        </button>
      </form>

      {response && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px', border: '1px solid #ddd' }}>
          <h4>Respuesta de la Infraestructura AWS:</h4>
          <pre style={{ fontSize: '12px', overflowX: 'auto' }}>{JSON.stringify(response, null, 2)}</pre>
          
          {response.claimId && (
            <button onClick={() => generarPdf(response.claimId)} style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
              Generar Reporte PDF
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;