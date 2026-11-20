(() => {
    "use strict";

    const readJSON = (key, fallback) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.error(`No se pudo leer ${key} del almacenamiento local.`, error);
            return fallback;
        }
    };
    const writeJSON = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`No se pudo guardar ${key} en el almacenamiento local.`, error);
            showToast("No se pudieron guardar los cambios en este navegador.");
            return false;
        }
    };
    const storedSession = readJSON("fitia-session", null);
    const session = storedSession && typeof storedSession.email === "string" ? storedSession : null;
    const userStorageKey = key => session ? `${key}:${encodeURIComponent(session.email)}` : key;
    let toastTimer;
    function showToast(message) {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
    }

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const meals = readJSON(userStorageKey("fitia-meals"), []);
    const isToday = meal => meal.date === today;
    const todayMeals = () => meals.filter(isToday);
    const readRecipe = card => ({
        name: card.dataset.name,
        time: Number(card.dataset.time),
        cost: Number(card.dataset.cost),
        calories: Number(card.dataset.calories),
        protein: Number(card.dataset.protein),
        carbs: Number(card.dataset.carbs),
        fat: Number(card.dataset.fat)
    });
    const saveMeal = recipe => {
        meals.push({ ...recipe, date: today, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
        writeJSON(userStorageKey("fitia-meals"), meals);
        showToast(`${recipe.name} agregado a tu progreso.`);
        renderMeals();
        renderDashboard();
    };

    const recipeList = document.getElementById("recipe-list");
    if (recipeList) {
        const cards = Array.from(recipeList.querySelectorAll(".recipe-card"));
        const search = document.getElementById("recipe-search");
        const quick = document.getElementById("quick-filter");
        const measures = document.getElementById("home-measures");
        const sort = document.getElementById("sort-recipes");
        const count = document.getElementById("results-count");
        const empty = document.getElementById("empty-recipes");
        const dialog = document.getElementById("nutrition-dialog");
        const normalizeText = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
        const availableIngredients = [
            { name: "Huevos", key: "huevo", category: "Proteínas", icon: "🥚" },
            { name: "Atún", key: "atun", category: "Proteínas", icon: "🐟" },
            { name: "Pollo", key: "pollo", category: "Proteínas", icon: "🍗" },
            { name: "Arroz", key: "arroz", category: "Cereales", icon: "🍚" },
            { name: "Avena", key: "avena", category: "Cereales", icon: "🥣" },
            { name: "Pan", key: "pan", category: "Cereales", icon: "🍞" },
            { name: "Papa", key: "papa", category: "Verduras", icon: "🥔" },
            { name: "Tomate", key: "tomate", category: "Verduras", icon: "🍅" },
            { name: "Zanahoria", key: "zanahoria", category: "Verduras", icon: "🥕" },
            { name: "Brócoli", key: "brocoli", category: "Verduras", icon: "🥦" },
            { name: "Lechuga", key: "lechuga", category: "Verduras", icon: "🥬" },
            { name: "Cebolla", key: "cebolla", category: "Verduras", icon: "🧅" },
            { name: "Plátano", key: "platano", category: "Frutas", icon: "🍌" },
            { name: "Leche", key: "leche", category: "Lácteos", icon: "🥛" }
        ];
        const selectedIngredients = new Set();
        const ingredientList = document.getElementById("ingredient-list");
        const ingredientSearch = document.getElementById("ingredient-search");
        const ingredientCategories = document.getElementById("ingredient-categories");
        const selectedCount = document.getElementById("selected-count");
        const selectedTags = document.getElementById("selected-ingredients");
        const clearIngredients = document.getElementById("clear-ingredients");
        let activeIngredientCategory = "Todos";
        let selectedRecipe;
        const refreshRecipes = () => {
            const query = normalizeText(search.value.trim());
            cards.forEach(card => {
                const recipeIngredients = new Set(normalizeText(card.dataset.ingredients).split(/\s+/));
                const matchesSearch = normalizeText(`${card.dataset.name} ${card.dataset.ingredients}`).includes(query);
                const matchesAvailableIngredients = selectedIngredients.size === 0
                    || Array.from(selectedIngredients).some(ingredient => recipeIngredients.has(ingredient));
                card.hidden = !matchesSearch || !matchesAvailableIngredients
                    || (quick.checked && Number(card.dataset.time) >= 15);
                const ingredients = card.querySelector(".ingredients-preview");
                ingredients.textContent = measures.checked ? ingredients.dataset.house : ingredients.dataset.grams;
            });
            const visible = cards.filter(card => !card.hidden);
            visible.sort((a, b) => {
                if (sort.value === "cost") return Number(a.dataset.cost) - Number(b.dataset.cost);
                if (sort.value === "time") return Number(a.dataset.time) - Number(b.dataset.time);
                return Number(a.dataset.time) - Number(b.dataset.time) || Number(a.dataset.cost) - Number(b.dataset.cost);
            }).forEach(card => recipeList.appendChild(card));
            const resultLabel = `${visible.length} ${visible.length === 1 ? "receta encontrada" : "recetas encontradas"}`;
            count.textContent = selectedIngredients.size
                ? `${resultLabel} · incluyen al menos un ingrediente seleccionado`
                : resultLabel;
            empty.hidden = visible.length > 0;
        };
        const updateSelectedIngredients = () => {
            selectedCount.textContent = `${selectedIngredients.size} ${selectedIngredients.size === 1 ? "seleccionado" : "seleccionados"}`;
            clearIngredients.disabled = selectedIngredients.size === 0;
            selectedTags.replaceChildren();
            if (selectedIngredients.size === 0) {
                const hint = document.createElement("span");
                hint.className = "muted";
                hint.textContent = "Aún no seleccionas ingredientes.";
                selectedTags.appendChild(hint);
                return;
            }
            selectedIngredients.forEach(key => {
                const ingredient = availableIngredients.find(item => item.key === key);
                if (!ingredient) return;
                const tag = document.createElement("button");
                tag.className = "selected-ingredient";
                tag.type = "button";
                tag.textContent = `${ingredient.name} ×`;
                tag.setAttribute("aria-label", `Quitar ${ingredient.name} de los ingredientes disponibles`);
                tag.addEventListener("click", () => {
                    selectedIngredients.delete(key);
                    renderIngredientList();
                    updateSelectedIngredients();
                    refreshRecipes();
                });
                selectedTags.appendChild(tag);
            });
        };
        const renderIngredientList = () => {
            const query = normalizeText(ingredientSearch.value.trim());
            const visibleIngredients = availableIngredients.filter(ingredient => {
                const matchesCategory = activeIngredientCategory === "Todos" || ingredient.category === activeIngredientCategory;
                return matchesCategory && normalizeText(ingredient.name).includes(query);
            });
            ingredientList.replaceChildren();
            if (visibleIngredients.length === 0) {
                const message = document.createElement("p");
                message.className = "muted";
                message.textContent = "No encontramos ese ingrediente.";
                ingredientList.appendChild(message);
                return;
            }
            visibleIngredients.forEach(ingredient => {
                const label = document.createElement("label");
                label.className = `ingredient-option${selectedIngredients.has(ingredient.key) ? " selected" : ""}`;
                const icon = document.createElement("span");
                icon.className = "ingredient-icon";
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = ingredient.icon;
                const copy = document.createElement("span");
                copy.className = "ingredient-copy";
                const name = document.createElement("strong");
                name.textContent = ingredient.name;
                const status = document.createElement("small");
                status.textContent = selectedIngredients.has(ingredient.key) ? "Disponible" : ingredient.category;
                copy.append(name, status);
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = selectedIngredients.has(ingredient.key);
                checkbox.setAttribute("aria-label", `Tengo ${ingredient.name}`);
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) selectedIngredients.add(ingredient.key);
                    else selectedIngredients.delete(ingredient.key);
                    label.classList.toggle("selected", checkbox.checked);
                    status.textContent = checkbox.checked ? "Disponible" : ingredient.category;
                    updateSelectedIngredients();
                    refreshRecipes();
                });
                label.append(icon, copy, checkbox);
                ingredientList.appendChild(label);
            });
        };
        ingredientSearch.addEventListener("input", renderIngredientList);
        ingredientCategories.addEventListener("click", event => {
            const button = event.target.closest("button[data-category]");
            if (!button) return;
            activeIngredientCategory = button.dataset.category;
            ingredientCategories.querySelectorAll("button[data-category]").forEach(categoryButton => {
                categoryButton.setAttribute("aria-pressed", String(categoryButton === button));
            });
            renderIngredientList();
        });
        clearIngredients.addEventListener("click", () => {
            selectedIngredients.clear();
            renderIngredientList();
            updateSelectedIngredients();
            refreshRecipes();
        });
        [search, quick, measures, sort].forEach(control => control.addEventListener(control === search ? "input" : "change", refreshRecipes));
        const openNutrition = card => {
            selectedRecipe = readRecipe(card);
            document.getElementById("dialog-title").textContent = selectedRecipe.name;
            document.getElementById("dialog-description").textContent = `${card.dataset.time} min · S/ ${selectedRecipe.cost.toFixed(2)} · Saciedad ${card.dataset.satiety.toLowerCase()}.`;
            document.getElementById("macro-calories").textContent = `${selectedRecipe.calories} kcal`;
            document.getElementById("macro-protein").textContent = `${selectedRecipe.protein} g`;
            document.getElementById("macro-carbs").textContent = `${selectedRecipe.carbs} g`;
            document.getElementById("macro-fat").textContent = `${selectedRecipe.fat} g`;
            const steps = document.getElementById("dialog-steps");
            steps.replaceChildren(...card.dataset.steps.split("|").map(step => {
                const item = document.createElement("li");
                item.textContent = step;
                return item;
            }));
            dialog.showModal();
        };
        recipeList.addEventListener("click", event => {
            const button = event.target.closest("button");
            if (!button) return;
            const card = button.closest(".recipe-card");
            if (button.classList.contains("detail-button")) openNutrition(card);
            if (button.classList.contains("add-recipe")) saveMeal(readRecipe(card));
        });
        document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        document.getElementById("dialog-add").addEventListener("click", () => {
            if (selectedRecipe) saveMeal(selectedRecipe);
            dialog.close();
        });
        renderIngredientList();
        updateSelectedIngredients();
        refreshRecipes();
    }

    function renderMeals() {
        const list = document.getElementById("meal-list");
        if (!list) return;
        const entries = todayMeals();
        list.replaceChildren();
        entries.forEach(meal => {
            const item = document.createElement("article");
            item.className = "meal-card surface";
            item.innerHTML = `<div><h3></h3><p class="muted"></p></div><button class="remove-meal" type="button" aria-label="Quitar alimento">×</button>`;
            item.querySelector("h3").textContent = meal.name;
            item.querySelector("p").textContent = `${meal.calories} kcal · ${meal.protein} g de proteína · S/ ${meal.cost.toFixed(2)}`;
            item.querySelector("button").addEventListener("click", () => {
                const index = meals.findIndex(entry => entry.id === meal.id);
                if (index >= 0) meals.splice(index, 1);
                writeJSON(userStorageKey("fitia-meals"), meals);
                renderMeals();
                renderDashboard();
            });
            list.appendChild(item);
        });
        const empty = document.getElementById("empty-meals");
        if (empty) empty.hidden = entries.length > 0;
    }

    function renderDashboard() {
        const entries = todayMeals();
        const count = document.getElementById("meal-count");
        if (count) count.textContent = `${entries.length} ${entries.length === 1 ? "comida" : "comidas"}`;
        const calories = entries.reduce((sum, meal) => sum + meal.calories, 0);
        const totalCalories = document.getElementById("total-calories");
        if (totalCalories) totalCalories.textContent = `${calories} kcal`;
        const totalCost = document.getElementById("total-cost");
        if (totalCost) totalCost.textContent = `S/ ${entries.reduce((sum, meal) => sum + meal.cost, 0).toFixed(2)}`;
        const protein = entries.reduce((sum, meal) => sum + meal.protein, 0);
        const carbs = entries.reduce((sum, meal) => sum + meal.carbs, 0);
        const fat = entries.reduce((sum, meal) => sum + meal.fat, 0);
        [["protein", protein, 95], ["carbs", carbs, 250], ["fat", fat, 60]].forEach(([name, value, goal]) => {
            const valueEl = document.getElementById(`${name}-value`);
            const bar = document.getElementById(`${name}-bar`);
            if (valueEl) valueEl.textContent = `${value} / ${goal} g`;
            if (bar) {
                bar.style.width = `${Math.min(100, (value / goal) * 100)}%`;
                const progress = bar.closest('[role="progressbar"]');
                if (progress) progress.setAttribute("aria-valuenow", String(Math.min(value, goal)));
            }
        });
    }

    renderMeals();
    renderDashboard();

    const shoppingList = document.getElementById("shopping-list");
    if (shoppingList) {
        const budgetInput = document.getElementById("shopping-budget");
        const savedBudget = readJSON(userStorageKey("fitia-shopping-budget"), null);
        let budget = Number.isFinite(savedBudget) && savedBudget >= 0 ? savedBudget : null;
        if (budget !== null) budgetInput.value = String(budget);
        let items = readJSON(userStorageKey("fitia-shopping"), null) || [
            { name: "Plátano", category: "Frutas y verduras", cost: 2, checked: false },
            { name: "Tomate", category: "Frutas y verduras", cost: 2, checked: false },
            { name: "Lechuga", category: "Frutas y verduras", cost: 3, checked: false },
            { name: "Huevos (docena)", category: "Proteínas", cost: 8, checked: false },
            { name: "Atún (lata)", category: "Proteínas", cost: 5, checked: false },
            { name: "Pollo (filete)", category: "Proteínas", cost: 7, checked: false },
            { name: "Arroz", category: "Cereales", cost: 4, checked: false },
            { name: "Avena", category: "Cereales", cost: 4, checked: false },
            { name: "Pan", category: "Cereales", cost: 3, checked: false }
        ];
        const baseGroups = ["Frutas y verduras", "Proteínas", "Cereales"];
        const categorySelect = document.getElementById("item-category");
        const customCategoryInput = document.getElementById("custom-category");
        const customOption = categorySelect.querySelector('option[value="__custom__"]');
        const updateCategoryOptions = () => {
            const selectedCategory = categorySelect.value;
            categorySelect.querySelectorAll("option[data-saved-category]").forEach(option => option.remove());
            const existingCategories = [...new Set(items
                .map(item => item.category)
                .filter(category => !baseGroups.includes(category)))]
                .sort((a, b) => a.localeCompare(b, "es"));
            existingCategories.forEach(category => {
                const option = document.createElement("option");
                option.value = category;
                option.textContent = category;
                option.dataset.savedCategory = "true";
                categorySelect.insertBefore(option, customOption);
            });
            if (Array.from(categorySelect.options).some(option => option.value === selectedCategory)) {
                categorySelect.value = selectedCategory;
            }
        };
        const updateCustomCategoryField = () => {
            const isCustomCategory = categorySelect.value === "__custom__";
            customCategoryInput.hidden = !isCustomCategory;
            customCategoryInput.required = isCustomCategory;
            if (!isCustomCategory) customCategoryInput.value = "";
        };
        categorySelect.addEventListener("change", updateCustomCategoryField);
        const renderShopping = () => {
            updateCategoryOptions();
            shoppingList.replaceChildren();
            const customGroups = [...new Set(items.map(item => item.category).filter(category => !baseGroups.includes(category)))]
                .sort((a, b) => a.localeCompare(b, "es"));
            const groups = [...baseGroups, ...customGroups];
            groups.forEach(category => {
                const groupItems = items.filter(item => item.category === category);
                if (!groupItems.length) return;
                const section = document.createElement("section");
                section.className = "shopping-group surface";
                const title = document.createElement("h3");
                title.textContent = category;
                section.appendChild(title);
                groupItems.forEach(item => {
                    const row = document.createElement("div");
                    row.className = `shopping-item${item.checked ? " checked" : ""}`;
                    row.innerHTML = `<label><input type="checkbox"><span></span></label><small class="muted"></small><button class="remove-item" type="button"></button>`;
                    row.querySelector("input").checked = item.checked;
                    row.querySelector("span").textContent = item.name;
                    row.querySelector("small").textContent = `S/ ${Number(item.cost).toFixed(2)}`;
                    const removeButton = row.querySelector(".remove-item");
                    removeButton.textContent = "×";
                    removeButton.setAttribute("aria-label", `Quitar ${item.name}`);
                    row.querySelector("input").addEventListener("change", event => {
                        item.checked = event.target.checked;
                        writeJSON(userStorageKey("fitia-shopping"), items);
                        renderShopping();
                    });
                    removeButton.addEventListener("click", () => {
                        items.splice(items.indexOf(item), 1);
                        writeJSON(userStorageKey("fitia-shopping"), items);
                        renderShopping();
                    });
                    section.appendChild(row);
                });
                shoppingList.appendChild(section);
            });
            const pending = items.filter(item => !item.checked);
            const total = pending.reduce((sum, item) => sum + Number(item.cost), 0);
            const plannedTotal = items.reduce((sum, item) => sum + Number(item.cost), 0);
            const totalEl = document.getElementById("shopping-total");
            const budgetValueEl = document.getElementById("shopping-budget-value");
            const countEl = document.getElementById("shopping-count");
            const progressEl = document.getElementById("shopping-progress");
            if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
            if (budgetValueEl) budgetValueEl.textContent = budget === null ? "Sin definir" : `S/ ${budget.toFixed(2)}`;
            if (countEl) countEl.textContent = `${items.filter(item => item.checked).length} de ${items.length} productos`;
            const budgetStatus = document.getElementById("shopping-budget-status");
            if (budgetStatus) {
                budgetStatus.classList.toggle("over-budget", budget !== null && plannedTotal > budget);
                if (budget === null) {
                    budgetStatus.textContent = "Define tu presupuesto para ver cuánto te queda.";
                } else if (plannedTotal > budget) {
                    budgetStatus.textContent = `Superas tu presupuesto por S/ ${(plannedTotal - budget).toFixed(2)}.`;
                } else {
                    budgetStatus.textContent = `Te quedan S/ ${(budget - plannedTotal).toFixed(2)} de tu presupuesto.`;
                }
            }
            if (progressEl) {
                const completed = items.filter(item => item.checked).length;
                progressEl.style.width = `${items.length ? completed / items.length * 100 : 0}%`;
                const progress = progressEl.closest('[role="progressbar"]');
                if (progress) progress.setAttribute("aria-valuenow", String(items.length ? Math.round(completed / items.length * 100) : 0));
            }
        };
        document.getElementById("shopping-budget-form").addEventListener("submit", event => {
            event.preventDefault();
            const value = Number(budgetInput.value);
            if (budgetInput.value.trim() === "" || !Number.isFinite(value) || value < 0) {
                showToast("Ingresa un presupuesto válido mayor o igual a S/ 0.");
                budgetInput.focus();
                return;
            }
            if (!writeJSON(userStorageKey("fitia-shopping-budget"), value)) return;
            budget = value;
            renderShopping();
            showToast("Presupuesto actualizado.");
        });
        document.getElementById("add-item-form").addEventListener("submit", event => {
            event.preventDefault();
            const input = document.getElementById("new-item");
            const costInput = document.getElementById("new-item-cost");
            const name = input.value.trim();
            if (!name) return;
            const isCustomCategory = categorySelect.value === "__custom__";
            const enteredCategory = isCustomCategory ? customCategoryInput.value.trim() : categorySelect.value;
            if (!enteredCategory) {
                showToast("Escribe un nombre para la categoría.");
                customCategoryInput.focus();
                return;
            }
            const cost = costInput.value === "" ? 0 : Number(costInput.value);
            if (!Number.isFinite(cost) || cost < 0) {
                showToast("Ingresa un costo válido o deja el campo vacío.");
                return;
            }
            const categories = [...baseGroups, ...items.map(item => item.category)];
            const category = categories.find(existing => existing.toLocaleLowerCase("es") === enteredCategory.toLocaleLowerCase("es")) || enteredCategory;
            const plannedTotal = items.reduce((sum, item) => sum + Number(item.cost), 0);
            const exceedsBudget = budget !== null && plannedTotal + cost > budget;
            items.push({ name, category, cost, checked: false });
            event.currentTarget.reset();
            updateCustomCategoryField();
            writeJSON(userStorageKey("fitia-shopping"), items);
            renderShopping();
            showToast(exceedsBudget
                ? `${name} agregado. Supera tu presupuesto por S/ ${(plannedTotal + cost - budget).toFixed(2)}.`
                : `${name} agregado a ${category}.`);
        });
        updateCategoryOptions();
        updateCustomCategoryField();
        renderShopping();
    }

    const accountGuest = document.getElementById("account-guest");
    if (accountGuest) {
        const accountPanel = document.getElementById("account-session");
        const authMessage = document.getElementById("auth-message");
        const loginForm = document.getElementById("login-form");
        const registerForm = document.getElementById("register-form");
        const authTabs = document.getElementById("auth-tabs");
        const setAuthMessage = (message, isError) => {
            authMessage.textContent = message;
            authMessage.classList.toggle("error", Boolean(isError));
        };
        const showAuthMode = mode => {
            const isLogin = mode === "login";
            loginForm.hidden = !isLogin;
            registerForm.hidden = isLogin;
            authTabs.querySelectorAll("button[data-mode]").forEach(button => {
                button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
            });
            setAuthMessage("", false);
        };
        if (session) {
            accountGuest.hidden = true;
            accountPanel.hidden = false;
            document.getElementById("account-greeting").textContent = `¡Hola, ${session.name || session.email}!`;
            document.getElementById("account-email").textContent = session.email;
        } else {
            accountGuest.hidden = false;
            accountPanel.hidden = true;
        }
        authTabs.addEventListener("click", event => {
            const button = event.target.closest("button[data-mode]");
            if (button) showAuthMode(button.dataset.mode);
        });

        const encodeBase64 = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
        const decodeBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
        const hashPassword = async (password, salt) => {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error("Este navegador no permite proteger contraseñas en este contexto.");
            }
            const key = await window.crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(password),
                "PBKDF2",
                false,
                ["deriveBits"]
            );
            const bits = await window.crypto.subtle.deriveBits(
                { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
                key,
                256
            );
            return encodeBase64(new Uint8Array(bits));
        };
        const migrateGuestData = email => {
            try {
                ["fitia-meals", "fitia-shopping", "fitia-shopping-budget"].forEach(key => {
                    const accountKey = `${key}:${encodeURIComponent(email)}`;
                    if (localStorage.getItem(accountKey) !== null) return;
                    const guestData = localStorage.getItem(key);
                    if (guestData !== null) localStorage.setItem(accountKey, guestData);
                });
                return true;
            } catch (error) {
                console.error("No se pudieron copiar los datos locales a la cuenta.", error);
                setAuthMessage("La cuenta se creó, pero no se pudieron copiar los datos anteriores. Inicia sesión para continuar.", true);
                return false;
            }
        };
        const startSession = (email, name) => {
            if (!writeJSON("fitia-session", { email, name })) return false;
            window.location.assign("../index.html");
            return true;
        };

        loginForm.addEventListener("submit", async event => {
            event.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLocaleLowerCase("es");
            const password = document.getElementById("login-password").value;
            const users = readJSON("fitia-users", {}) || {};
            const user = users[email];
            if (!user || !user.passwordSalt || !user.passwordHash) {
                setAuthMessage("No encontramos una cuenta con ese correo.", true);
                return;
            }
            try {
                const passwordHash = await hashPassword(password, decodeBase64(user.passwordSalt));
                if (passwordHash !== user.passwordHash) {
                    setAuthMessage("La contraseña no coincide. Inténtalo otra vez.", true);
                    return;
                }
                startSession(user.email, user.name);
            } catch (error) {
                console.error("No se pudo verificar la contraseña local.", error);
                setAuthMessage(error.message || "No se pudo iniciar sesión en este navegador.", true);
            }
        });

        registerForm.addEventListener("submit", async event => {
            event.preventDefault();
            const name = document.getElementById("register-name").value.trim();
            const email = document.getElementById("register-email").value.trim().toLocaleLowerCase("es");
            const password = document.getElementById("register-password").value;
            const confirmation = document.getElementById("register-confirm-password").value;
            if (password.length < 8) {
                setAuthMessage("La contraseña debe tener al menos 8 caracteres.", true);
                return;
            }
            if (password !== confirmation) {
                setAuthMessage("Las contraseñas no coinciden.", true);
                return;
            }
            const users = readJSON("fitia-users", {}) || {};
            if (users[email]) {
                setAuthMessage("Ya existe una cuenta con ese correo en este navegador.", true);
                return;
            }
            try {
                const salt = window.crypto.getRandomValues(new Uint8Array(16));
                const passwordHash = await hashPassword(password, salt);
                users[email] = {
                    name,
                    email,
                    passwordSalt: encodeBase64(salt),
                    passwordHash
                };
                if (!writeJSON("fitia-users", users)) return;
                if (!migrateGuestData(email)) return;
                startSession(email, name);
            } catch (error) {
                console.error("No se pudo crear la cuenta local.", error);
                setAuthMessage(error.message || "No se pudo crear la cuenta en este navegador.", true);
            }
        });

        document.getElementById("logout-button").addEventListener("click", () => {
            try {
                localStorage.removeItem("fitia-session");
                window.location.assign("../index.html");
            } catch (error) {
                console.error("No se pudo cerrar la sesión local.", error);
                document.getElementById("account-message").textContent = "No se pudo cerrar la sesión. Inténtalo otra vez.";
            }
        });
    }
})();
