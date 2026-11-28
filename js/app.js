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
    const storedFavorites = readJSON(userStorageKey("fitia-favorites"), []);
    const favorites = Array.isArray(storedFavorites)
        ? storedFavorites.filter(item => item && typeof item.name === "string")
        : [];
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
    const storedMeals = readJSON(userStorageKey("fitia-meals"), []);
    const meals = Array.isArray(storedMeals) ? storedMeals : [];
    const isToday = meal => meal.date === today;
    const todayMeals = () => meals.filter(isToday);
    const portionOptions = [0.5, 1, 1.5, 2];
    let refreshRecipesAfterPantry = () => {};
    let refreshShoppingView = () => {};
    const portionLabel = portion => `${portion}x`;
    const scaleRecipe = (recipe, portion) => ({
        ...recipe,
        calories: Math.round(Number(recipe.calories) * portion),
        protein: Math.round(Number(recipe.protein) * portion),
        carbs: Math.round(Number(recipe.carbs) * portion),
        fat: Math.round(Number(recipe.fat) * portion),
        cost: Number((Number(recipe.cost) * portion).toFixed(2)),
        portion
    });
    const formatPortionSummary = (recipe, portion) => {
        const scaled = scaleRecipe(recipe, portion);
        return `${scaled.calories} kcal · ${scaled.protein} g P · ${scaled.carbs} g C · ${scaled.fat} g G · S/ ${scaled.cost.toFixed(2)}`;
    };
    const readRecipe = card => ({
        name: card.dataset.name,
        time: Number(card.dataset.time),
        cost: Number(card.dataset.cost),
        calories: Number(card.dataset.calories),
        protein: Number(card.dataset.protein),
        carbs: Number(card.dataset.carbs),
        fat: Number(card.dataset.fat)
    });
    const saveMeal = (recipe, portion = 1) => {
        const meal = {
            ...scaleRecipe(recipe, portion),
            date: today,
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`
        };
        meals.push(meal);
        if (!writeJSON(userStorageKey("fitia-meals"), meals)) {
            meals.pop();
            return;
        }
        showToast(`${meal.name} (${portionLabel(portion)}) agregado a tu progreso.`);
        renderMeals();
        renderDashboard();
        renderQuickMeals();
    };

    function renderQuickMeals() {
        const container = document.getElementById("quick-meals");
        if (!container) return;
        container.replaceChildren();
        const recentMeals = todayMeals().slice(-5).reverse();
        const recentRecipes = recentMeals.map(meal => ({
            ...meal,
            calories: Number(meal.calories) / (Number(meal.portion) || 1),
            protein: Number(meal.protein) / (Number(meal.portion) || 1),
            carbs: Number(meal.carbs) / (Number(meal.portion) || 1),
            fat: Number(meal.fat) / (Number(meal.portion) || 1),
            cost: Number(meal.cost) / (Number(meal.portion) || 1)
        }));
        const entries = [
            { title: "Favoritas", recipes: favorites, empty: "Marca una estrella en una receta para guardarla aquí." },
            { title: "Recientes", recipes: recentRecipes, empty: "Tus comidas de hoy aparecerán aquí para agregarlas rápido." }
        ];
        entries.forEach(group => {
            const section = document.createElement("section");
            section.className = "quick-meal-group";
            const heading = document.createElement("h3");
            heading.textContent = group.title;
            section.appendChild(heading);
            if (!group.recipes.length) {
                const empty = document.createElement("p");
                empty.className = "muted";
                empty.textContent = group.empty;
                section.appendChild(empty);
            }
            group.recipes.slice(0, 5).forEach(recipe => {
                const row = document.createElement("div");
                row.className = "quick-meal-row";
                const copy = document.createElement("div");
                copy.className = "quick-meal-copy";
                const name = document.createElement("strong");
                name.textContent = recipe.name;
                const description = document.createElement("span");
                description.textContent = `${Math.round(recipe.calories)} kcal · S/ ${Number(recipe.cost).toFixed(2)}`;
                copy.append(name, description);
                const actions = document.createElement("div");
                actions.className = "quick-meal-actions";
                const portion = document.createElement("select");
                portion.className = "portion-select";
                portion.setAttribute("aria-label", `Porción de ${recipe.name}`);
                portionOptions.forEach(value => {
                    const option = document.createElement("option");
                    option.value = String(value);
                    option.textContent = portionLabel(value);
                    if (value === 1) option.selected = true;
                    portion.appendChild(option);
                });
                description.textContent = formatPortionSummary(recipe, Number(portion.value));
                portion.addEventListener("change", () => {
                    description.textContent = formatPortionSummary(recipe, Number(portion.value));
                });
                const add = document.createElement("button");
                add.className = "button button-primary";
                add.type = "button";
                add.textContent = "Agregar";
                add.addEventListener("click", () => saveMeal(recipe, Number(portion.value)));
                const favorite = document.createElement("button");
                favorite.className = "icon-button quick-favorite";
                favorite.type = "button";
                const isFavorite = favorites.some(item => item.name === recipe.name);
                favorite.setAttribute("aria-pressed", String(isFavorite));
                favorite.setAttribute("aria-label", `${isFavorite ? "Quitar de" : "Agregar a"} favoritas: ${recipe.name}`);
                favorite.textContent = "★";
                favorite.addEventListener("click", () => toggleFavorite(recipe));
                actions.append(portion, add, favorite);
                row.append(copy, actions);
                section.appendChild(row);
            });
            container.appendChild(section);
        });
    }

    const toggleFavorite = recipe => {
        const index = favorites.findIndex(item => item.name === recipe.name);
        if (index >= 0) favorites.splice(index, 1);
        else favorites.unshift({
            name: recipe.name,
            time: Number(recipe.time) || 0,
            cost: Number(recipe.cost) || 0,
            calories: Number(recipe.calories) || 0,
            protein: Number(recipe.protein) || 0,
            carbs: Number(recipe.carbs) || 0,
            fat: Number(recipe.fat) || 0
        });
        if (!writeJSON(userStorageKey("fitia-favorites"), favorites)) {
            if (index >= 0) favorites.splice(index, 0, recipe);
            else favorites.shift();
            return;
        }
        showToast(index >= 0 ? `${recipe.name} quitado de favoritas.` : `${recipe.name} guardado en favoritas.`);
        renderQuickMeals();
        document.querySelectorAll(".recipe-card").forEach(card => {
            if (card.dataset.name === recipe.name) updateFavoriteButton(card, recipe);
        });
    };

    const updateFavoriteButton = (card, recipe) => {
        let button = card.querySelector(".favorite-toggle");
        if (!button) {
            button = document.createElement("button");
            button.className = "favorite-toggle";
            button.type = "button";
            button.textContent = "★";
            button.addEventListener("click", () => toggleFavorite(readRecipe(card)));
            card.appendChild(button);
        }
        const isFavorite = favorites.some(item => item.name === recipe.name);
        button.setAttribute("aria-pressed", String(isFavorite));
        button.setAttribute("aria-label", `${isFavorite ? "Quitar de" : "Agregar a"} favoritas: ${recipe.name}`);
        button.title = isFavorite ? "Quitar de favoritas" : "Guardar en favoritas";
    };

    document.querySelectorAll("[data-module-guide]").forEach(guide => {
        const savedGuideState = readJSON(userStorageKey("fitia-guide-seen"), {});
        const seen = savedGuideState && typeof savedGuideState === "object" && !Array.isArray(savedGuideState)
            ? savedGuideState
            : {};
        const moduleName = guide.dataset.moduleGuide;
        if (seen[moduleName]) return;
        guide.hidden = false;
        guide.querySelector("[data-dismiss-guide]").addEventListener("click", () => {
            seen[moduleName] = true;
            if (writeJSON(userStorageKey("fitia-guide-seen"), seen)) guide.hidden = true;
        });
    });

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
        const scannedPantry = readJSON(userStorageKey("fitia-pantry"), []);
        const validKeys = new Set(availableIngredients.map(i => i.key));
        const selectedIngredients = new Set(Array.isArray(scannedPantry) ? scannedPantry.filter(key => validKeys.has(key)) : []);
        const ingredientList = document.getElementById("ingredient-list");
        const ingredientSearch = document.getElementById("ingredient-search");
        const ingredientCategories = document.getElementById("ingredient-categories");
        const selectedCount = document.getElementById("selected-count");
        const selectedTags = document.getElementById("selected-ingredients");
        const clearIngredients = document.getElementById("clear-ingredients");
        let activeIngredientCategory = "Todos";
        let selectedRecipe;
        cards.forEach(card => {
            const recipe = readRecipe(card);
            updateFavoriteButton(card, recipe);
            const portionLabelEl = document.createElement("label");
            portionLabelEl.className = "recipe-portion";
            portionLabelEl.textContent = "Porción";
            const portionSelect = document.createElement("select");
            portionSelect.className = "portion-select";
            portionSelect.setAttribute("aria-label", `Porción de ${recipe.name}`);
            portionOptions.forEach(value => {
                const option = document.createElement("option");
                option.value = String(value);
                option.textContent = portionLabel(value);
                if (value === 1) option.selected = true;
                portionSelect.appendChild(option);
            });
            portionLabelEl.appendChild(portionSelect);
            const portionSummary = document.createElement("output");
            portionSummary.className = "portion-summary";
            portionSummary.setAttribute("aria-live", "polite");
            portionSummary.textContent = formatPortionSummary(recipe, Number(portionSelect.value));
            portionSelect.addEventListener("change", () => {
                portionSummary.textContent = formatPortionSummary(recipe, Number(portionSelect.value));
            });
            card.querySelector(".recipe-card-body").insertBefore(portionLabelEl, card.querySelector(".recipe-actions"));
            card.querySelector(".recipe-card-body").insertBefore(portionSummary, card.querySelector(".recipe-actions"));
        });
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
            const portion = Number(card.querySelector(".portion-select").value);
            selectedRecipe = scaleRecipe(readRecipe(card), portion);
            document.getElementById("dialog-title").textContent = selectedRecipe.name;
            document.getElementById("dialog-description").textContent = `${card.dataset.time} min · ${portionLabel(portion)} · S/ ${selectedRecipe.cost.toFixed(2)} · Saciedad ${card.dataset.satiety.toLowerCase()}.`;
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
            if (button.classList.contains("add-recipe")) saveMeal(readRecipe(card), Number(card.querySelector(".portion-select").value));
        });
        document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
        dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
        document.getElementById("dialog-add").addEventListener("click", () => {
            if (selectedRecipe) saveMeal(readRecipe(cards.find(card => card.dataset.name === selectedRecipe.name)), selectedRecipe.portion);
            dialog.close();
        });
        refreshRecipesAfterPantry = () => {
            const latestPantry = readJSON(userStorageKey("fitia-pantry"), []);
            selectedIngredients.clear();
            (Array.isArray(latestPantry) ? latestPantry : []).forEach(key => {
                if (validKeys.has(key)) selectedIngredients.add(key);
            });
            renderIngredientList();
            updateSelectedIngredients();
            refreshRecipes();
        };
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
            const main = document.createElement("div");
            main.className = "meal-card-main";
            const title = document.createElement("h3");
            title.textContent = meal.name;
            const description = document.createElement("p");
            description.className = "muted";
            description.textContent = `${meal.calories} kcal · ${meal.protein} g de proteína · S/ ${Number(meal.cost).toFixed(2)}`;
            main.append(title, description);
            const editToggle = document.createElement("button");
            editToggle.className = "button button-secondary meal-edit-toggle";
            editToggle.type = "button";
            editToggle.textContent = "Editar";
            const remove = document.createElement("button");
            remove.className = "remove-meal";
            remove.type = "button";
            remove.setAttribute("aria-label", `Quitar ${meal.name}`);
            remove.textContent = "×";
            const form = document.createElement("form");
            form.className = "meal-edit-form";
            form.hidden = true;
            form.innerHTML = `
                <label class="edit-name-field">Nombre
                    <input name="name" type="text" maxlength="100" required>
                </label>
                <label>Porción
                    <select name="portion"></select>
                </label>
                <label>Calorías (kcal)
                    <input name="calories" type="number" min="0" step="1" required>
                </label>
                <label>Costo (S/)
                    <input name="cost" type="number" min="0" step="0.10" inputmode="decimal" required>
                </label>
                <div class="meal-edit-actions">
                    <button class="button button-secondary cancel-edit" type="button">Cancelar</button>
                    <button class="button button-primary" type="submit">Guardar</button>
                </div>`;
            const portionSelect = form.elements.portion;
            portionOptions.forEach(value => {
                const option = document.createElement("option");
                option.value = String(value);
                option.textContent = portionLabel(value);
                portionSelect.appendChild(option);
            });
            const currentPortion = Number(meal.portion) || 1;
            portionSelect.value = String(portionOptions.includes(currentPortion) ? currentPortion : 1);
            form.elements.name.value = meal.name;
            form.elements.calories.value = String(meal.calories);
            form.elements.cost.value = String(Number(meal.cost).toFixed(2));
            const scaleEditValues = () => {
                const ratio = Number(portionSelect.value) / currentPortion;
                form.elements.calories.value = String(Math.round(Number(meal.calories) * ratio));
                form.elements.cost.value = (Number(meal.cost) * ratio).toFixed(2);
            };
            portionSelect.addEventListener("change", scaleEditValues);
            editToggle.addEventListener("click", () => {
                form.hidden = !form.hidden;
                editToggle.textContent = form.hidden ? "Editar" : "Cerrar edición";
                if (!form.hidden) form.elements.name.focus();
            });
            form.querySelector(".cancel-edit").addEventListener("click", () => {
                form.hidden = true;
                editToggle.textContent = "Editar";
            });
            form.addEventListener("submit", event => {
                event.preventDefault();
                const name = form.elements.name.value.trim();
                const calories = Number(form.elements.calories.value);
                const cost = Number(form.elements.cost.value);
                const nextPortion = Number(portionSelect.value);
                if (!name || !Number.isFinite(calories) || calories < 0 || !Number.isFinite(cost) || cost < 0) {
                    showToast("Revisa el nombre, las calorías y el costo.");
                    return;
                }
                const previous = { ...meal };
                const ratio = nextPortion / currentPortion;
                const nutritionRatio = Number(meal.calories) ? calories / Number(meal.calories) : ratio;
                Object.assign(meal, {
                    name,
                    calories: Math.round(calories),
                    protein: Math.round(Number(meal.protein) * nutritionRatio),
                    carbs: Math.round(Number(meal.carbs) * nutritionRatio),
                    fat: Math.round(Number(meal.fat) * nutritionRatio),
                    cost: Number(cost.toFixed(2)),
                    portion: nextPortion
                });
                if (!writeJSON(userStorageKey("fitia-meals"), meals)) {
                    Object.assign(meal, previous);
                    return;
                }
                showToast(`${meal.name} actualizado.`);
                renderMeals();
                renderDashboard();
                renderQuickMeals();
            });
            remove.addEventListener("click", () => {
                const index = meals.findIndex(entry => entry.id === meal.id);
                if (index >= 0) meals.splice(index, 1);
                if (!writeJSON(userStorageKey("fitia-meals"), meals)) {
                    meals.splice(index, 0, meal);
                    return;
                }
                showToast(`${meal.name} quitado de tu progreso.`);
                renderMeals();
                renderDashboard();
                renderQuickMeals();
            });
            item.append(main, editToggle, remove, form);
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
        const shoppingItems = readJSON(userStorageKey("fitia-shopping"), []);
        const purchasedCost = (Array.isArray(shoppingItems) ? shoppingItems : [])
            .filter(item => item.checked)
            .reduce((sum, item) => sum + Number(item.cost || 0), 0);
        const mealCost = entries.reduce((sum, meal) => sum + Number(meal.cost || 0), 0);
        if (totalCost) totalCost.textContent = `S/ ${(mealCost + purchasedCost).toFixed(2)}`;
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
    renderQuickMeals();

    const shoppingList = document.getElementById("shopping-list");
    if (shoppingList) {
        const budgetInput = document.getElementById("shopping-budget");
        const savedBudget = readJSON(userStorageKey("fitia-shopping-budget"), null);
        let budget = Number.isFinite(savedBudget) && savedBudget >= 0 ? savedBudget : null;
        if (budget !== null) budgetInput.value = String(budget);
        const savedItems = readJSON(userStorageKey("fitia-shopping"), null);
        let items = Array.isArray(savedItems) ? savedItems : [
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
        if (savedItems === null) writeJSON(userStorageKey("fitia-shopping"), items);
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
            const plannedTotal = items.reduce((sum, item) => sum + Number(item.cost), 0);
            const totalEl = document.getElementById("shopping-total");
            const budgetValueEl = document.getElementById("shopping-budget-value");
            const countEl = document.getElementById("shopping-count");
            const progressEl = document.getElementById("shopping-progress");
            if (totalEl) totalEl.textContent = `S/ ${plannedTotal.toFixed(2)}`;
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
        refreshShoppingView = () => {
            const latestItems = readJSON(userStorageKey("fitia-shopping"), []);
            items = Array.isArray(latestItems) ? latestItems : [];
            renderShopping();
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
                ["fitia-meals", "fitia-shopping", "fitia-shopping-budget", "fitia-pantry", "fitia-favorites", "fitia-guide-seen"].forEach(key => {
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
    const scanRecipes = [
        { name: "Arroz con atún", key: "arroz-atun", time: 14, cost: 6, calories: 385, protein: 24, carbs: 52, fat: 9 },
        { name: "Avena con plátano", key: "avena-platano", time: 10, cost: 3.5, calories: 310, protein: 12, carbs: 48, fat: 8 },
        { name: "Ensalada de pollo", key: "ensalada-pollo", time: 13, cost: 7, calories: 305, protein: 31, carbs: 20, fat: 11 },
        { name: "Sándwich de huevo", key: "sandwich-huevo", time: 12, cost: 4, calories: 330, protein: 19, carbs: 32, fat: 14 },
        { name: "Tortilla de papa", key: "tortilla-papa", time: 18, cost: 4.5, calories: 330, protein: 16, carbs: 36, fat: 13 }
    ];
    const ingredientCatalog = [
        ["arroz", "arroz"], ["atun", "atún"], ["avena", "avena"], ["platano", "plátano"],
        ["pollo", "pollo"], ["huevo", "huevo"], ["pan", "pan"], ["papa", "papa"],
        ["lechuga", "lechuga"], ["tomate", "tomate"], ["aceite", "aceite"], ["cebolla", "cebolla"],
        ["zanahoria", "zanahoria"], ["leche", "leche"]
    ];
    const normalizeText = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    let tesseractPromise;

    const initializeScanner = () => {
        const uiHTML = `
            <button class="scan-fab" id="open-scan" type="button" aria-haspopup="dialog">📷 <span>Escanear</span></button>
            <div class="scan-modal" id="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title" aria-hidden="true">
                <section class="scan-card">
                    <div class="modal-header"><h2 id="scan-title">Escanear y registrar</h2><button class="icon-button" id="close-scan" type="button" aria-label="Cerrar escáner">×</button></div>
                    <p class="scan-description">Registra una compra con OCR o añade una estimación de tu plato.</p>
                    <label class="scan-mode-field" for="scan-mode">¿Qué quieres registrar?
                        <select id="scan-mode"><option value="receipt">Boleta o ingredientes (OCR)</option><option value="meal">Plato servido</option></select>
                    </label>
                    <input class="scan-file-input" type="file" id="scan-input" accept="image/*" capture="environment">
                    <button class="button button-secondary" id="choose-scan-image" type="button">Tomar o subir foto</button>
                    <img id="scan-preview" class="scan-preview" alt="Vista previa de la imagen seleccionada">
                    <div id="scan-result" class="scan-result" aria-live="polite"></div>
                    <div class="scan-actions">
                        <button class="button button-primary" id="confirm-scan" type="button" hidden>Confirmar y sincronizar</button>
                        <button class="button button-secondary" id="cancel-scan" type="button">Cancelar</button>
                    </div>
                </section>
            </div>`;
        document.body.insertAdjacentHTML("beforeend", uiHTML);

        const modal = document.getElementById("scan-modal");
        const input = document.getElementById("scan-input");
        const preview = document.getElementById("scan-preview");
        const result = document.getElementById("scan-result");
        const confirm = document.getElementById("confirm-scan");
        const mode = document.getElementById("scan-mode");
        const chooseImage = document.getElementById("choose-scan-image");
        let currentMode = mode.value;
        let previewUrl = "";
        let scanRequest = 0;

        const clearScan = () => {
            scanRequest += 1;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            preview.removeAttribute("src");
            preview.style.display = "none";
            input.value = "";
            mode.disabled = false;
            chooseImage.disabled = false;
            result.replaceChildren();
            confirm.hidden = true;
        };
        const closeModal = () => {
            modal.classList.remove("active");
            modal.setAttribute("aria-hidden", "true");
            clearScan();
            document.getElementById("open-scan").focus();
        };
        const addScanField = (labelText, field) => {
            const label = document.createElement("label");
            label.className = "scan-field";
            label.append(document.createTextNode(labelText), field);
            result.appendChild(label);
            return field;
        };
        const prepareReceipt = async file => {
            const request = ++scanRequest;
            result.replaceChildren();
            confirm.hidden = true;
            mode.disabled = true;
            chooseImage.disabled = true;
            const progress = document.createElement("p");
            progress.className = "scan-progress";
            progress.textContent = "Preparando OCR…";
            result.appendChild(progress);
            try {
                if (!window.Tesseract && !tesseractPromise) {
                    tesseractPromise = new Promise((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("No se pudo cargar el motor OCR. Revisa tu conexión e inténtalo otra vez."));
                        document.head.appendChild(script);
                    });
                }
                if (tesseractPromise) await tesseractPromise;
                const { data: { text } } = await window.Tesseract.recognize(file, "spa", {
                    logger: message => {
                        if (request === scanRequest && message.status === "recognizing text") {
                            progress.textContent = `Leyendo boleta… ${Math.round(message.progress * 100)}%`;
                        }
                    }
                });
                if (request !== scanRequest) return;
                const { total, ingredients } = analyzeReceipt(text);
                result.replaceChildren();
                const intro = document.createElement("p");
                intro.textContent = "Revisa los datos detectados y corrígelos antes de guardar.";
                result.appendChild(intro);
                const cost = document.createElement("input");
                cost.id = "scan-cost";
                cost.type = "number";
                cost.min = "0";
                cost.step = "0.10";
                cost.inputMode = "decimal";
                cost.value = total.toFixed(2);
                cost.required = true;
                addScanField("Gasto total (S/)", cost);
                const names = document.createElement("input");
                names.id = "scan-ingredients";
                names.type = "text";
                names.maxLength = 300;
                names.value = ingredients.map(item => item.label).join(", ");
                addScanField("Ingredientes, separados por comas", names);
                confirm.hidden = false;
            } catch (error) {
                if (request !== scanRequest) return;
                if (!window.Tesseract) tesseractPromise = null;
                console.error("No se pudo procesar la boleta con OCR.", error);
                result.replaceChildren();
                const message = document.createElement("p");
                message.setAttribute("role", "alert");
                message.textContent = error.message || "No se pudo leer la imagen. Prueba con una foto más nítida.";
                result.appendChild(message);
            } finally {
                if (request === scanRequest) {
                    mode.disabled = false;
                    chooseImage.disabled = false;
                }
            }
        };
        const prepareMeal = () => {
            result.replaceChildren();
            const intro = document.createElement("p");
            intro.textContent = "La foto no identifica el plato automáticamente. Elige la opción más parecida y confirma o ajusta la estimación.";
            result.appendChild(intro);
            const select = document.createElement("select");
            select.id = "scan-meal";
            scanRecipes.forEach(recipe => {
                const option = document.createElement("option");
                option.value = recipe.key;
                option.textContent = recipe.name;
                select.appendChild(option);
            });
            const portion = document.createElement("select");
            portion.id = "scan-portion";
            portionOptions.forEach(value => {
                const option = document.createElement("option");
                option.value = String(value);
                option.textContent = portionLabel(value);
                if (value === 1) option.selected = true;
                portion.appendChild(option);
            });
            const calories = document.createElement("input");
            calories.id = "scan-calories";
            calories.type = "number";
            calories.min = "0";
            calories.step = "1";
            calories.required = true;
            const cost = document.createElement("input");
            cost.id = "scan-cost";
            cost.type = "number";
            cost.min = "0";
            cost.step = "0.10";
            cost.inputMode = "decimal";
            cost.required = true;
            addScanField("Plato estimado", select);
            addScanField("Porción", portion);
            addScanField("Calorías (kcal)", calories);
            addScanField("Costo estimado (S/)", cost);
            const updateMealEstimate = () => {
                const recipe = scanRecipes.find(item => item.key === select.value);
                const multiplier = Number(portion.value);
                calories.value = String(Math.round(recipe.calories * multiplier));
                cost.value = (recipe.cost * multiplier).toFixed(2);
            };
            select.addEventListener("change", updateMealEstimate);
            portion.addEventListener("change", updateMealEstimate);
            updateMealEstimate();
            confirm.hidden = false;
        };
        const normalizeIngredientKeys = value => value.split(",")
            .map(item => normalizeText(item.trim()))
            .filter(Boolean);

        document.getElementById("open-scan").addEventListener("click", () => {
            modal.classList.add("active");
            modal.setAttribute("aria-hidden", "false");
            mode.focus();
        });
        document.getElementById("close-scan").addEventListener("click", closeModal);
        document.getElementById("cancel-scan").addEventListener("click", closeModal);
        modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && modal.classList.contains("active")) closeModal();
        });
        mode.addEventListener("change", () => {
            currentMode = mode.value;
            clearScan();
            if (currentMode === "meal") prepareMeal();
        });
        chooseImage.addEventListener("click", () => input.click());
        input.addEventListener("change", async () => {
            const file = input.files[0];
            if (!file) return;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(file);
            preview.src = previewUrl;
            preview.style.display = "block";
            currentMode = mode.value;
            if (currentMode === "receipt") await prepareReceipt(file);
            else prepareMeal();
        });
        confirm.addEventListener("click", () => {
            if (currentMode === "meal") {
                const recipe = scanRecipes.find(item => item.key === document.getElementById("scan-meal").value);
                const caloriesField = document.getElementById("scan-calories");
                const costField = document.getElementById("scan-cost");
                const calories = Number(caloriesField.value);
                const cost = Number(costField.value);
                const portion = Number(document.getElementById("scan-portion").value);
                if (!recipe || !caloriesField.value.trim() || calories <= 0 || !Number.isFinite(calories) || !costField.value.trim() || !Number.isFinite(cost) || cost < 0) {
                    showToast("Revisa las calorías y el costo estimado.");
                    return;
                }
                const base = scaleRecipe(recipe, calories / (recipe.calories * portion));
                base.cost = cost / portion;
                saveMeal(base, portion);
                closeModal();
                return;
            }

            const costField = document.getElementById("scan-cost");
            const cost = Number(costField.value);
            if (!costField.value.trim() || !Number.isFinite(cost) || cost < 0) {
                showToast("Ingresa un gasto válido en S/.");
                return;
            }
            const enteredIngredients = normalizeIngredientKeys(document.getElementById("scan-ingredients").value);
            const pantryKeys = [...new Set(enteredIngredients
                .map(value => ingredientCatalog.find(([key, label]) => key === value || normalizeText(label) === value)?.[0])
                .filter(Boolean))];
            const itemNames = enteredIngredients.map(name => {
                const match = ingredientCatalog.find(([key, label]) => key === name || normalizeText(label) === name);
                const displayName = match ? match[1] : name;
                return displayName.charAt(0).toLocaleUpperCase("es") + displayName.slice(1);
            });
            const existing = readJSON(userStorageKey("fitia-shopping"), []);
            const items = Array.isArray(existing) ? existing : [];
            const names = itemNames.length ? itemNames : ["Compra escaneada"];
            let assigned = 0;
            names.forEach((name, index) => {
                const itemCost = index === names.length - 1
                    ? Number((cost - assigned).toFixed(2))
                    : Number((cost / names.length).toFixed(2));
                assigned += itemCost;
                items.push({ name: `${name} (Boleta)`, category: "Escaneado", cost: itemCost, checked: true });
            });
            if (!writeJSON(userStorageKey("fitia-shopping"), items)) return;
            if (!writeJSON(userStorageKey("fitia-pantry"), pantryKeys)) return;
            refreshShoppingView();
            refreshRecipesAfterPantry();
            renderDashboard();
            showToast(`Compra de S/ ${cost.toFixed(2)} sincronizada con Compras y tu despensa.`);
            closeModal();
        });
    };

    const analyzeReceipt = text => {
        const normalized = normalizeText(text);
        let total = 0;
        const totalMatch = normalized.match(/total[\s:a-z]*(?:s\/\.?)?\s*(\d+[.,]\d{2})/);
        if (totalMatch) total = Number(totalMatch[1].replace(",", "."));
        else {
            const amounts = [...normalized.matchAll(/(\d+[.,]\d{2})/g)].map(match => Number(match[1].replace(",", ".")));
            if (amounts.length) total = Math.max(...amounts);
        }
        const ingredients = ingredientCatalog
            .filter(([key]) => normalized.includes(key))
            .map(([key, label]) => ({ key, label }));
        return { total, ingredients };
    };

    initializeScanner();
    window.addEventListener("storage", event => {
        if (event.key === userStorageKey("fitia-meals")) {
            const latestMeals = readJSON(userStorageKey("fitia-meals"), []);
            if (Array.isArray(latestMeals)) meals.splice(0, meals.length, ...latestMeals);
            renderMeals();
            renderDashboard();
            renderQuickMeals();
        }
        if (event.key === userStorageKey("fitia-shopping")) {
            refreshShoppingView();
            renderDashboard();
        }
        if (event.key === userStorageKey("fitia-pantry")) refreshRecipesAfterPantry();
        if (event.key === userStorageKey("fitia-favorites")) {
            const latestFavorites = readJSON(userStorageKey("fitia-favorites"), []);
            if (Array.isArray(latestFavorites)) favorites.splice(0, favorites.length, ...latestFavorites);
            renderQuickMeals();
            document.querySelectorAll(".recipe-card").forEach(card => updateFavoriteButton(card, readRecipe(card)));
        }
    });
})();