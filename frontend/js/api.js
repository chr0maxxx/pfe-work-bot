// API клиент для работы с backend

class API {
  constructor() {
    this.baseUrl = "";
    this.sessionId = localStorage.getItem("session_id") || null;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
    localStorage.setItem("session_id", sessionId);
  }

  async request(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;

    if (this.sessionId) {
      const separator = url.includes("?") ? "&" : "?";
      url += `${separator}session_id=${this.sessionId}`;
    }

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        if (data.error) {
            // Логируем ошибку на сервере
            console.error('API Error:', endpoint, data.error);
            throw new Error(data.error);
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', endpoint, error);
        throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  // ===== AUTH =====

  async authTelegram(initData) {
    const response = await this.post("/api/auth/telegram", { initData });

    if (response.success && response.session_id) {
      this.setSessionId(response.session_id);
    }

    return response;
  }

  async authAdmin(username, password) {
    const response = await this.post("/api/auth/admin", { username, password });

    if (response.success && response.session_id) {
      this.setSessionId(response.session_id);
    }

    return response;
  }

  // ===== USER =====

  async getMe() {
    return this.get("/api/me");
  }

  // ===== PROJECTS =====

  async getProjects() {
    return this.get("/api/projects");
  }

  async getProject(projectId) {
    return this.get(`/api/projects/${projectId}`);
  }

  async createProject(data) {
    return this.post("/api/projects", data);
  }

  async updateProject(projectId, data) {
    return this.patch(`/api/projects/${projectId}`, data);
  }

  // ===== TASKS =====

  async getTasks(projectId = null) {
    const params = projectId ? `?project_id=${projectId}` : "";
    return this.get(`/api/tasks${params}`);
  }

  async createTask(data) {
    return this.post("/api/tasks", data);
  }

  async updateTask(taskId, data) {
    return this.patch(`/api/tasks/${taskId}`, data);
  }

  async completeTask(taskId) {
    return this.post(`/api/tasks/${taskId}/complete`);
  }

  async deleteTask(taskId) {
    return this.delete(`/api/tasks/${taskId}`);
  }

  // ===== FINANCES =====

  async getFinances() {
    return this.get("/api/finances");
  }

  async registerClientPayment(projectId, amount) {
    return this.post("/api/finances/client-payment", {
      project_id: projectId,
      amount,
    });
  }

  async registerPayout(projectId, userId, amount) {
    return this.post("/api/finances/payout", {
      project_id: projectId,
      user_id: userId,
      amount,
    });
  }

  // ===== SETTINGS =====

  async getSettings() {
    return this.get("/api/settings");
  }

  async updateSettings(data) {
    return this.patch("/api/settings", data);
  }

  // ===== REQUISITES =====

  async getRequisites() {
    return this.get("/api/requisites");
  }

  async updateRequisites(data) {
    return this.patch("/api/requisites", data);
  }

  // ===== LOGS (admin) =====

  async getLogs(filter = "all") {
    const params = filter !== "all" ? `?filter=${filter}` : "";
    return this.get(`/api/logs${params}`);
  }

  async clearLogs() {
    return this.delete("/api/logs");
  }

  // ===== UPDATES (Polling) =====

  async getUpdates(since = null) {
    const params = since ? `&since=${since}` : "";
    return this.get(`/api/updates?dummy=1${params}`);
  }
}

const api = new API();
