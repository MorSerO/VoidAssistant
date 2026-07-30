const { app } = require("electron"); console.log("app type:", typeof app); console.log("app keys:", app ? Object.keys(app).slice(0,10) : "null");
