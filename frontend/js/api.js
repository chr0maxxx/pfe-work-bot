// API клиент для работы с backend

class API {
  constructor() {
    this.baseUrl = "";
  }

  // Базовый метод для запросов
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // Важно для cookies
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Request failed");
      }

      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  // GET запрос
  async get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  // POST запрос
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // PATCH запрос
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // DELETE запрос
  async delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  // ===== AUTH =====

  async authTelegram(initData) {
    return this.post("/api/auth/telegram", { initData });
  }

  async authAdmin(username, password) {
    return this.post("/api/auth/admin", { username, password });
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

  // ===== UPDATES (Polling) =====

  async getUpdates(since = null) {
    const params = since ? `?since=${since}` : "";
    return this.get(`/api/updates${params}`);
  }
}

// Создаём глобальный экземпляр
const api = new API();
