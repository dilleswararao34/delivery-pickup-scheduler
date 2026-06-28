import axios from 'axios';

const TOKEN_KEY = 'sd_digitals_token';

// ─── Axios instance ───────────────────────────────────────────────────────────
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});

// Response interceptor: unwrap envelope, handle 401/403
http.interceptors.response.use(
  (res) => {
    if (res.data?.success === false) {
      const err = new Error(res.data.error?.message || 'API error');
      err.code   = res.data.error?.code;
      err.fields = res.data.error?.fields;
      err.status = res.status;
      return Promise.reject(err);
    }
    return res.data;
  },
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.error?.message || error.message || 'Network error';
    const code    = error.response?.data?.error?.code;
    const fields  = error.response?.data?.error?.fields;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('sd_digitals_user');
      window.location.href = '/login';
    }

    const err = new Error(message);
    err.code   = code;
    err.status = status;
    err.fields = fields;
    return Promise.reject(err);
  }
);

// ─── API Client ───────────────────────────────────────────────────────────────
const apiClient = {

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    const res = await http.post('/auth/login', { email, password });
    return res.data;
  },

  async register(payload) {
    const res = await http.post('/auth/register', payload);
    return res.data;
  },

  async googleLogin(name, email) {
    const res = await http.post('/auth/google', { name, email });
    return res.data;
  },

  // ── Bookings ───────────────────────────────────────────────────────────────
  async getBookings(params = {}) {
    return http.get('/bookings', { params });
  },

  async getBooking(id) {
    return http.get(`/bookings/${id}`);
  },

  async createBooking(payload) {
    return http.post('/bookings', payload);
  },

  async updateBookingStatus(id, payload) {
    return http.put(`/bookings/${id}/status`, {
      new_status: payload.new_status,
      changed_by: payload.changed_by,
      reason: payload.reason,
      operations_update: payload.operations_update
    });
  },

  // ── Quotations ─────────────────────────────────────────────────────────────
  async getQuotations(params = {}) {
    return http.get('/quotations', { params });
  },

  async getQuotation(id) {
    return http.get(`/quotations/${id}`);
  },

  async reviseQuote(id, reason_for_revision) {
    return http.post(`/quotations/${id}/revise`, { reason_for_revision });
  },

  async acceptQuote(id, version_id) {
    return http.post(`/quotations/${id}/accept`, { version_id });
  },

  async rejectQuote(id) {
    return http.post(`/quotations/${id}/reject`);
  },

  async sendRevisedQuote(id, payload) {
    return http.post(`/quotations/${id}/admin/send-revised-quote`, payload);
  },

  async downloadInvoicePDF(bookingId) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const response = await fetch(`${baseUrl}/bookings/invoices/${bookingId}/pdf`, {
      headers
    });
    if (!response.ok) throw new Error('Failed to download invoice PDF');
    return response.blob();
  },

  async exportBookingsCSV(params = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const query = new URLSearchParams(params).toString();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const response = await fetch(`${baseUrl}/bookings/export/csv?${query}`, {
      headers
    });
    if (!response.ok) throw new Error('Failed to export CSV');
    return response.blob();
  },

  // ── Dashboard & Damage Reports ─────────────────────────────────────────────
  async getDashboard() {
    return http.get('/dashboard');
  },

  async logDamageReport(payload) {
    return http.post('/damage-report', payload);
  },

  // ── Equipment ──────────────────────────────────────────────────────────────
  async getEquipment(params = {}) {
    return http.get('/equipment', { params });
  },

  async createEquipment(payload) {
    return http.post('/equipment', payload);
  },

  async updateEquipmentStatus(id, status) {
    return http.put(`/equipment/${id}/status`, { status });
  },

  // ── Alerts ─────────────────────────────────────────────────────────────────
  async getAlerts() {
    return http.get('/bookings/alerts');
  },

  async resolveAlert(id) {
    return http.delete(`/bookings/alerts/${id}`);
  },

  // ── Employees & Management ───────────────────────────────────────────────────
  async listEmployees() {
    return http.get('/auth/employees');
  },

  async createEmployee(payload) {
    return http.post('/auth/employees', payload);
  },

  async updateEmployeeStatus(id, isActive) {
    return http.put(`/auth/employees/${id}/status`, { is_active: isActive });
  },

  async forcePasswordReset(id, tempPassword) {
    return http.post(`/auth/employees/${id}/reset-password`, { tempPassword });
  },

  async changePassword(oldPassword, newPassword) {
    return http.put('/auth/password', { oldPassword, newPassword });
  },

  async getActivityLogs(params = {}) {
    return http.get('/auth/activity-logs', { params });
  },

  async getCustomers() {
    return http.get('/auth/customers');
  },

  async updateProfile(payload) {
    return http.put('/auth/profile', payload);
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  async createRazorpayOrder(type, id) {
    return http.post('/payments/create-order', { type, id });
  },

  async refundDeposit(depositId, reason) {
    return http.post(`/payments/deposits/${depositId}/refund`, { reason });
  },

  async selectCODPayment(invoiceId) {
    return http.post('/payments/select-cod', { invoiceId });
  },

  async markCODInvoicePaid(invoiceId) {
    return http.post(`/payments/invoices/${invoiceId}/mark-paid`);
  },

  // ── Quotations ────────────────────────────────────────────────────────────
  async getQuotations(params = {}) {
    return http.get('/quotations', { params });
  },

  async getQuotation(id) {
    return http.get(`/quotations/${id}`);
  },

  async requestRevision(id, notes) {
    return http.post(`/quotations/${id}/revise`, { notes });
  },

  async acceptQuote(id, versionId) {
    return http.post(`/quotations/${id}/accept`, { versionId });
  },

  // ── AI Chatbot ────────────────────────────────────────────────────────────
  // messages: [{ role: 'user'|'model', content: string }]
  async sendChatMessage(messages) {
    return http.post('/chat', { messages });
  },

  // ─── Legacy api.* shape (backwards compat for existing hooks) ────────────
  get api() {
    return {
      bookings: {
        list:         (p) => this.getBookings(p),
        get:          (id) => this.getBooking(id),
        create:       (p) => this.createBooking(p),
        updateStatus: (id, p) => this.updateBookingStatus(id, p),
      },
      equipment: {
        list:         (p) => this.getEquipment(p),
        updateStatus: (id, status) => this.updateEquipmentStatus(id, status),
      },
      alerts:    { 
        list: () => this.getAlerts(),
        resolve: (id) => this.resolveAlert(id)
      },
    };
  },
};

export default apiClient;

// Legacy named export for backwards compatibility with existing hooks
export const api = {
  bookings: {
    list:         (p)     => apiClient.getBookings(p),
    get:          (id)    => apiClient.getBooking(id),
    create:       (p)     => apiClient.createBooking(p),
    updateStatus: (id, p) => apiClient.updateBookingStatus(id, p),
  },
  equipment: {
    list:         (p) => apiClient.getEquipment(p),
    updateStatus: (id, status) => apiClient.updateEquipmentStatus(id, status),
  },
  alerts:    { 
    list: ()  => apiClient.getAlerts(),
    resolve: (id) => apiClient.resolveAlert(id)
  },
};
