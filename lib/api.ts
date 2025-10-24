const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  // Auth
  login: (cnpj: string, username: string, password: string) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ cnpj, username, password }),
    }),

  // Products
  getProducts: () => apiRequest("/products"),
  createProduct: (data: any) =>
    apiRequest("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Partners
  getPartners: () => apiRequest("/partners"),
  getPartner: (id: string) => apiRequest(`/partners/${id}`),

  // Invoices
  getInvoices: () => apiRequest("/invoices"),
  uploadInvoice: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return apiRequest("/invoices/upload", {
      method: "POST",
      body: formData,
      headers: {},
    })
  },

  // Commissions
  getCommissions: () => apiRequest("/commissions"),
  calculateCommission: (invoiceId: string) =>
    apiRequest(`/commissions/calculate/${invoiceId}`, {
      method: "POST",
    }),

  // Payments
  getPayments: () => apiRequest("/payments"),
  createPayment: (data: any) =>
    apiRequest("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
