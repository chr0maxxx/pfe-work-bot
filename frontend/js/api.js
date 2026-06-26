class API {
  constructor() {
    this.baseUrl = "";
    // Получаем session_id из localStorage
    this.sessionId = localStorage.getItem("session_id") || null;
  }

  // Сохранить session_id
  setSessionId(sessionId) {
    this.sessionId = sessionId;
    localStorage.setItem("session_id", sessionId);
  }

  // Базовый метод для запросов
  async request(endpoint, options = {}) {
    let url = `${this.baseUrl}${endpoint}`;

    // Добавляем session_id как query параметр
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

      // Проверяем, что ответ — JSON, а не HTML
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          "Server returned HTML instead of JSON. Backend may not be running.",
        );
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
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

  // ===== AUTH =====

  async authTelegram(initData) {
    const response = await this.post("/api/auth/telegram", { initData });

    // Сохраняем session_id
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

  // ===== Остальные методы (без изменений) =====

  async getMe() {
    return this.get("/api/me");
  }

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
    return this.request(`/api/tasks/${taskId}`, { method: "DELETE" });
  }

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

  async getSettings() {
    return this.get("/api/settings");
  }

  async updateSettings(data) {
    return this.patch("/api/settings", data);
  }

  async getRequisites() {
    return this.get("/api/requisites");
  }

  async updateRequisites(data) {
    return this.patch("/api/requisites", data);
  }

  async getUpdates(since = null) {
    const params = since ? `&since=${since}` : "";
    return this.get(`/api/updates?dummy=1${params}`);
  }
}

const api = new API();
