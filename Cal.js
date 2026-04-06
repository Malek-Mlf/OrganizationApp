document.addEventListener("DOMContentLoaded", function () {

    // ══════════════════════════════════════════
    // ── STOCKAGE (localStorage, sans SQL.js) ──
    // ══════════════════════════════════════════

    function _lire(cle, defaut) {
        try { return JSON.parse(localStorage.getItem(cle)) || defaut; }
        catch (e) { return defaut; }
    }
    function _ecrire(cle, valeur) {
        localStorage.setItem(cle, JSON.stringify(valeur));
    }

    function lireUtilisateurs() { return _lire("sf_users", []); }
    function sauvegarderUtilisateurs(tableau) { _ecrire("sf_users", tableau); }

    function lireTaches() {
        return _lire("sf_tasks", []).filter(function (t) { return t.userId === utilisateurConnecte.id; });
    }
    function lireToutesLesTaches() { return _lire("sf_tasks", []); }
    function sauvegarderTaches(tableau) { _ecrire("sf_tasks", tableau); }

    function lireConfigPlanning() {
        var configs = _lire("sf_cal_config", []);
        var row = configs.find(function (c) { return c.userId === utilisateurConnecte.id; });
        return row || { debut: 8, fin: 18, jours: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] };
    }
    function sauvegarderConfigPlanning(config) {
        var configs = _lire("sf_cal_config", []);
        var idx = configs.findIndex(function (c) { return c.userId === utilisateurConnecte.id; });
        config.userId = utilisateurConnecte.id;
        if (idx >= 0) configs[idx] = config; else configs.push(config);
        _ecrire("sf_cal_config", configs);
    }
    function lireDonneesPlanning() {
        var donnees = _lire("sf_cal_data", []);
        var obj = {};
        donnees.filter(function (d) { return d.userId === utilisateurConnecte.id; })
               .forEach(function (d) { obj[d.cle] = d.valeur; });
        return obj;
    }
    function sauvegarderCellule(jour, heure, texte) {
        var donnees = _lire("sf_cal_data", []);
        var cle = jour + "-" + heure;
        var idx = donnees.findIndex(function (d) { return d.userId === utilisateurConnecte.id && d.cle === cle; });
        if (texte === "") {
            if (idx >= 0) donnees.splice(idx, 1);
        } else {
            var entree = { userId: utilisateurConnecte.id, cle: cle, valeur: texte };
            if (idx >= 0) donnees[idx] = entree; else donnees.push(entree);
        }
        _ecrire("sf_cal_data", donnees);
    }
    function viderPlanning() {
        var donnees = _lire("sf_cal_data", []).filter(function (d) { return d.userId !== utilisateurConnecte.id; });
        _ecrire("sf_cal_data", donnees);
    }

    // ── SESSION ──
    var utilisateurConnecte = JSON.parse(sessionStorage.getItem("session") || "null");

    function ouvrir_session(utilisateur) {
        utilisateurConnecte = utilisateur;
        sessionStorage.setItem("session", JSON.stringify(utilisateur));
        afficherApplication();
    }
    function fermer_session() {
        utilisateurConnecte = null;
        sessionStorage.removeItem("session");
        afficherPageConnexion();
    }

    // ── VUES ──
    function afficherPageConnexion() {
        document.getElementById("viewLogin").classList.remove("hidden");
        document.getElementById("viewApp").classList.add("hidden");
    }
    function afficherApplication() {
        document.getElementById("viewLogin").classList.add("hidden");
        document.getElementById("viewApp").classList.remove("hidden");
        document.getElementById("navUser").textContent = "👤 " + utilisateurConnecte.name;
        afficherTaches();
        afficherTableauDeBord();
        afficherPlanning();
    }
    function afficherErreur(id, msg) { document.getElementById(id).textContent = msg; }
    async function afficherSucces(idElement, texte) {
        var element = document.getElementById(idElement);
        element.style.color = "var(--green)";
        element.textContent = texte;
        await new Promise(function (resolve) { setTimeout(resolve, 1200); });
        element.textContent = "";
        element.style.color = "";
    }

    // Affichage immédiat — plus d'attente SQL.js
    if (utilisateurConnecte !== null) { afficherApplication(); } else { afficherPageConnexion(); }

    // ── ONGLETS LOGIN ──
    document.querySelectorAll(".tab").forEach(function (onglet) {
        onglet.addEventListener("click", function () {
            document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
            document.querySelectorAll(".form").forEach(function (f) { f.classList.add("hidden"); });
            onglet.classList.add("active");
            document.getElementById(onglet.dataset.tab + "Form").classList.remove("hidden");
            document.getElementById("forgotStep2").classList.add("hidden");
            document.getElementById("btnReset").classList.add("hidden");
            document.getElementById("btnForgot").classList.remove("hidden");
            afficherErreur("forgotErr", "");
        });
    });

    // ── CONNEXION ──
    document.getElementById("btnLogin").addEventListener("click", function () {
        var identifiant = document.getElementById("loginName").value.trim();
        var motDePasse  = document.getElementById("loginPass").value;
        var utilisateur = lireUtilisateurs().find(function (u) { return u.name === identifiant && u.pass === motDePasse; });
        if (utilisateur) { ouvrir_session(utilisateur); }
        else { afficherErreur("loginErr", "❌ Identifiant ou mot de passe incorrect."); }
    });
    document.getElementById("loginPass").addEventListener("keypress", function (event) {
        if (event.key === "Enter") document.getElementById("btnLogin").click();
    });

    // ── INSCRIPTION ──
    document.getElementById("btnRegister").addEventListener("click", function () {
        var nom   = document.getElementById("regName").value.trim();
        var email = document.getElementById("regEmail").value.trim();
        var mdp   = document.getElementById("regPass").value;
        var mdp2  = document.getElementById("regPass2").value;
        if (!nom || !email || !mdp) { afficherErreur("regErr", "❌ Remplis tous les champs."); return; }
        if (mdp !== mdp2)           { afficherErreur("regErr", "❌ Les mots de passe ne correspondent pas."); return; }
        if (mdp.length < 4)         { afficherErreur("regErr", "❌ Mot de passe trop court (4 caractères min)."); return; }
        var listeUtilisateurs = lireUtilisateurs();
        if (listeUtilisateurs.find(function (u) { return u.name === nom; })) {
            afficherErreur("regErr", "❌ Cet identifiant est déjà utilisé."); return;
        }
        var nouvelUtilisateur = { id: Date.now(), name: nom, email: email, pass: mdp };
        listeUtilisateurs.push(nouvelUtilisateur);
        sauvegarderUtilisateurs(listeUtilisateurs);
        ouvrir_session(nouvelUtilisateur);
    });

    // ── MOT DE PASSE OUBLIÉ ──
    document.getElementById("btnForgot").addEventListener("click", function () {
        var nom   = document.getElementById("forgotName").value.trim();
        var email = document.getElementById("forgotEmail").value.trim();
        var utilisateur = lireUtilisateurs().find(function (u) { return u.name === nom && u.email === email; });
        if (!utilisateur) { afficherErreur("forgotErr", "❌ Identifiant ou e-mail introuvable."); return; }
        afficherErreur("forgotErr", "✅ Identité vérifiée. Choisis un nouveau mot de passe.");
        document.getElementById("forgotStep2").classList.remove("hidden");
        document.getElementById("btnForgot").classList.add("hidden");
        document.getElementById("btnReset").classList.remove("hidden");
    });
    document.getElementById("btnReset").addEventListener("click", function () {
        var nom  = document.getElementById("forgotName").value.trim();
        var mdp  = document.getElementById("newPass").value;
        var mdp2 = document.getElementById("newPass2").value;
        if (mdp !== mdp2)   { afficherErreur("forgotErr", "❌ Les mots de passe ne correspondent pas."); return; }
        if (mdp.length < 4) { afficherErreur("forgotErr", "❌ Mot de passe trop court."); return; }
        var listeUtilisateurs = lireUtilisateurs();
        var utilisateur = listeUtilisateurs.find(function (u) { return u.name === nom; });
        utilisateur.pass = mdp;
        sauvegarderUtilisateurs(listeUtilisateurs);
        afficherErreur("forgotErr", "✅ Mot de passe modifié ! Tu peux te connecter.");
        document.getElementById("forgotStep2").classList.add("hidden");
        document.getElementById("btnReset").classList.add("hidden");
        document.getElementById("btnForgot").classList.remove("hidden");
    });

    // ── DÉCONNEXION ──
    document.getElementById("btnLogout").addEventListener("click", function () {
        if (intervalleTimer !== null) { clearInterval(intervalleTimer); intervalleTimer = null; }
        quitterModeFocus();
        fermer_session();
    });

    // ── NAVIGATION ──
    var tousLesLiens = document.querySelectorAll("nav li");
    tousLesLiens.forEach(function (lien) {
        lien.addEventListener("click", function () {
            tousLesLiens.forEach(function (l) { l.classList.remove("active"); });
            document.querySelectorAll(".page").forEach(function (p) { p.classList.remove("active"); });
            lien.classList.add("active");
            document.getElementById(lien.dataset.page).classList.add("active");
        });
    });

    // ── MON COMPTE ──
    document.getElementById("btnProfile").addEventListener("click", function () {
        document.getElementById("profName").value  = utilisateurConnecte.name;
        document.getElementById("profEmail").value = utilisateurConnecte.email;
        document.getElementById("profPass").value  = "";
        afficherErreur("profMsg", "");
        document.getElementById("modalProfile").style.display = "flex";
    });
    document.getElementById("btnProfCancel").addEventListener("click", function () {
        document.getElementById("modalProfile").style.display = "none";
    });
    document.getElementById("btnProfSave").addEventListener("click", function () {
        var nouveauNom  = document.getElementById("profName").value.trim();
        var nouvelEmail = document.getElementById("profEmail").value.trim();
        var nouveauMdp  = document.getElementById("profPass").value;
        if (!nouveauNom || !nouvelEmail) { afficherErreur("profMsg", "❌ Identifiant et e-mail requis."); return; }
        var listeUtilisateurs = lireUtilisateurs();
        if (listeUtilisateurs.find(function (u) { return u.name === nouveauNom && u.id !== utilisateurConnecte.id; })) {
            afficherErreur("profMsg", "❌ Cet identifiant est déjà utilisé."); return;
        }
        var utilisateur = listeUtilisateurs.find(function (u) { return u.id === utilisateurConnecte.id; });
        utilisateur.name  = nouveauNom;
        utilisateur.email = nouvelEmail;
        if (nouveauMdp.length >= 4) {
            utilisateur.pass = nouveauMdp;
        } else if (nouveauMdp.length > 0 && nouveauMdp.length < 4) {
            afficherErreur("profMsg", "❌ Mot de passe trop court."); return;
        }
        sauvegarderUtilisateurs(listeUtilisateurs);
        utilisateurConnecte = utilisateur;
        sessionStorage.setItem("session", JSON.stringify(utilisateur));
        document.getElementById("navUser").textContent = "👤 " + utilisateur.name;
        afficherSucces("profMsg", "✅ Modifications enregistrées !").then(function () {
            document.getElementById("modalProfile").style.display = "none";
        });
    });

    // ── TÂCHES ──
    var filtreActif = "all";

    function afficherTaches() {
        var aujourdhui = new Date().toISOString().split("T")[0];
        var taches = lireTaches();
        if (filtreActif === "todo") taches = taches.filter(function (t) { return t.status === "todo"; });
        if (filtreActif === "done") taches = taches.filter(function (t) { return t.status === "done"; });
        if (filtreActif === "late") taches = taches.filter(function (t) { return t.status === "todo" && t.due !== "" && t.due < aujourdhui; });
        taches.sort(function (a, b) {
            if (!a.due && !b.due) return 0; if (!a.due) return 1; if (!b.due) return -1;
            return a.due.localeCompare(b.due);
        });
        var liste = document.getElementById("taskList");
        liste.innerHTML = "";
        if (taches.length === 0) { liste.innerHTML = "<li class='empty'>Aucune tâche ici 🎉</li>"; return; }
        for (var i = 0; i < taches.length; i++) {
            var tache    = taches[i];
            var enRetard = tache.status === "todo" && tache.due !== "" && tache.due < aujourdhui;
            var terminee = tache.status === "done";
            var li       = document.createElement("li");
            li.className = "task-item";
            if (terminee) li.classList.add("done");
            if (enRetard) li.classList.add("late");
            var htmlDate = tache.due ? "<span class='task-due " + (enRetard ? "due-red" : "due-blue") + "'>📅 " + formaterDate(tache.due) + "</span>" : "";
            var htmlDesc = tache.desc ? "<span class='task-desc'>" + tache.desc + "</span>" : "";
            li.innerHTML =
                "<input type='checkbox' " + (terminee ? "checked" : "") + " onchange='window._toggleTask(" + tache.id + ")'>" +
                "<div class='task-info'><span class='task-title'>" + tache.title + "</span>" + htmlDesc + htmlDate + "</div>" +
                "<button class='btn-del' onclick='window._supprimerTache(" + tache.id + ")' title='Supprimer'>×</button>";
            liste.appendChild(li);
        }
    }

    window._toggleTask = function (id) {
        var toutes = lireToutesLesTaches();
        var tache  = toutes.find(function (t) { return t.id === id; });
        if (tache) tache.status = (tache.status === "done") ? "todo" : "done";
        sauvegarderTaches(toutes); afficherTaches(); afficherTableauDeBord();
    };
    window._supprimerTache = function (id) {
        if (!confirm("Supprimer cette tâche ?")) return;
        sauvegarderTaches(lireToutesLesTaches().filter(function (t) { return t.id !== id; }));
        afficherTaches(); afficherTableauDeBord();
    };

    function ajouterTache() {
        var titre = document.getElementById("taskTitle").value.trim();
        if (!titre) {
            var champ = document.getElementById("taskTitle");
            champ.classList.add("shake");
            setTimeout(function () { champ.classList.remove("shake"); }, 500);
            return;
        }
        var toutes = lireToutesLesTaches();
        toutes.push({ id: Date.now(), userId: utilisateurConnecte.id, title: titre,
            desc: document.getElementById("taskDesc").value.trim(),
            due:  document.getElementById("taskDue").value, status: "todo" });
        sauvegarderTaches(toutes);
        document.getElementById("taskTitle").value = "";
        document.getElementById("taskDesc").value  = "";
        document.getElementById("taskDue").value   = "";
        afficherTaches(); afficherTableauDeBord();
    }

    document.getElementById("btnAdd").addEventListener("click", ajouterTache);
    document.getElementById("taskTitle").addEventListener("keypress", function (event) {
        if (event.key === "Enter") ajouterTache();
    });
    document.querySelectorAll(".pill").forEach(function (bouton) {
        bouton.addEventListener("click", function () {
            document.querySelectorAll(".pill").forEach(function (b) { b.classList.remove("active"); });
            bouton.classList.add("active");
            filtreActif = bouton.dataset.filter;
            afficherTaches();
        });
    });

    // ── TABLEAU DE BORD ──
    function afficherTableauDeBord() {
        var taches    = lireTaches();
        var total     = taches.length;
        var terminees = 0;
        for (var i = 0; i < taches.length; i++) { if (taches[i].status === "done") terminees++; }
        var pourcentage = (total > 0) ? Math.round((terminees / total) * 100) : 0;
        var aujourdhui  = new Date().toISOString().split("T")[0];
        document.getElementById("progBar").style.width = pourcentage + "%";
        document.getElementById("progPct").textContent = pourcentage + "%";
        var emojiEl = document.getElementById("homeEmoji");
        var msgEl   = document.getElementById("homeMsg");
        if      (total === 0)         { emojiEl.textContent = "✏️"; msgEl.textContent = "Ajoute ta première tâche !"; }
        else if (pourcentage === 0)   { emojiEl.textContent = "💪"; msgEl.textContent = "Allez " + utilisateurConnecte.name + ", c'est parti !"; }
        else if (pourcentage < 50)    { emojiEl.textContent = "🚀"; msgEl.textContent = "Tu prends le rythme !"; }
        else if (pourcentage < 100)   { emojiEl.textContent = "⚡"; msgEl.textContent = "Presque fini !"; }
        else                          { emojiEl.textContent = "🏆"; msgEl.textContent = "Objectifs atteints !"; }
        var urgentes = taches.filter(function (t) { return t.status === "todo"; });
        urgentes.sort(function (a, b) { if (!a.due) return 1; if (!b.due) return -1; return a.due.localeCompare(b.due); });
        urgentes = urgentes.slice(0, 4);
        var liste = document.getElementById("homeList");
        liste.innerHTML = "";
        if (urgentes.length === 0) { liste.innerHTML = "<li class='empty'>Aucune tâche en cours ✨</li>"; return; }
        urgentes.forEach(function (t) {
            var enRetard = t.due !== "" && t.due < aujourdhui;
            var li = document.createElement("li");
            li.className = "preview-item" + (enRetard ? " p-late" : "");
            var htmlBadge = t.due ? "<span class='badge " + (enRetard ? "b-red" : "b-blue") + "'>" + formaterDate(t.due) + "</span>" : "";
            li.innerHTML = "<span class='p-dot'></span><span class='p-text'>" + t.title + "</span>" + htmlBadge;
            liste.appendChild(li);
        });
    }

    // ── PLANNING ──
    var JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

    function afficherPlanning() {
        if (!utilisateurConnecte) return;
        var config  = lireConfigPlanning();
        var donnees = lireDonneesPlanning();
        var entete  = document.getElementById("calHead");
        var corps   = document.querySelector("#calTable tbody");
        entete.innerHTML = "<th>Heure</th>";
        for (var j = 0; j < config.jours.length; j++) entete.innerHTML += "<th>" + config.jours[j] + "</th>";
        corps.innerHTML = "";
        for (var h = config.debut; h <= config.fin; h++) {
            var ligne = document.createElement("tr");
            ligne.innerHTML = "<td class='hour-cell'>" + h + "h</td>";
            for (var jj = 0; jj < config.jours.length; jj++) {
                var jour    = config.jours[jj];
                var cellule = document.createElement("td");
                cellule.className       = "cal-cell";
                cellule.contentEditable = "true";
                cellule.textContent     = donnees[jour + "-" + h] || "";
                (function(j2, h2, cell) {
                    cell.addEventListener("blur", function () { sauvegarderCellule(j2, h2, cell.textContent.trim()); });
                })(jour, h, cellule);
                ligne.appendChild(cellule);
            }
            corps.appendChild(ligne);
        }
    }

    document.getElementById("btnEditCal").addEventListener("click", function () {
        var config      = lireConfigPlanning();
        var selectDebut = document.getElementById("calStart");
        var selectFin   = document.getElementById("calEnd");
        selectDebut.innerHTML = ""; selectFin.innerHTML = "";
        for (var i = 0; i <= 23; i++) {
            var texteHeure = String(i).padStart(2, "0") + ":00";
            selectDebut.innerHTML += "<option value='" + i + "'>" + texteHeure + "</option>";
            selectFin.innerHTML   += "<option value='" + i + "'>" + texteHeure + "</option>";
        }
        selectDebut.value = config.debut; selectFin.value = config.fin;
        var grille = document.getElementById("daysGrid");
        grille.innerHTML = "";
        for (var j = 0; j < JOURS_SEMAINE.length; j++) {
            var jour   = JOURS_SEMAINE[j];
            var cochee = config.jours.includes(jour);
            grille.innerHTML += "<label class='day-lbl'><input type='checkbox' value='" + jour + "' " + (cochee ? "checked" : "") + "> " + jour.slice(0, 3) + "</label>";
        }
        document.getElementById("modalCal").style.display = "flex";
    });
    document.getElementById("btnCalCancel").addEventListener("click", function () {
        document.getElementById("modalCal").style.display = "none";
    });
    document.getElementById("btnCalSave").addEventListener("click", function () {
        var debut = parseInt(document.getElementById("calStart").value);
        var fin   = parseInt(document.getElementById("calEnd").value);
        if (debut >= fin) { alert("L'heure de début doit être avant la fin."); return; }
        var joursChoisis = [];
        document.querySelectorAll("#daysGrid input:checked").forEach(function (input) { joursChoisis.push(input.value); });
        if (joursChoisis.length === 0) { alert("Sélectionne au moins un jour."); return; }
        sauvegarderConfigPlanning({ debut: debut, fin: fin, jours: joursChoisis });
        afficherPlanning();
        document.getElementById("modalCal").style.display = "none";
    });
    document.getElementById("btnClearCal").addEventListener("click", function () {
        if (!confirm("Effacer tout le planning ?")) return;
        viderPlanning(); afficherPlanning();
    });

    // ── FOCUS TIMER ──
    var intervalleTimer   = null;
    var secondesRestantes = 0;
    var secondesTotales   = 0;
    var CIRCONFERENCE     = 2 * Math.PI * 95;

    ["hours", "minutes", "seconds"].forEach(function (idChamp) {
        var champ = document.getElementById(idChamp);
        champ.addEventListener("input", function () { champ.value = champ.value.replace(/\D/g, "").slice(-2); });
        champ.addEventListener("blur",  function () { champ.value = champ.value ? champ.value.padStart(2, "0") : "00"; });
    });

    function mettreAJourAnneau() {
        var anneau = document.getElementById("ring");
        var offset = CIRCONFERENCE * (1 - secondesRestantes / secondesTotales);
        anneau.style.strokeDasharray  = CIRCONFERENCE;
        anneau.style.strokeDashoffset = offset;
    }
    function entrerModeFocus() {
        document.getElementById("focus").classList.add("focus-full");
        document.querySelector("nav").style.display = "none";
        document.body.style.overflow = "hidden";
    }
    function quitterModeFocus() {
        document.getElementById("focus").classList.remove("focus-full");
        document.querySelector("nav").style.display = "flex";
        document.body.style.overflow = "auto";
    }

    var boutonStart = document.getElementById("btnStart");
    boutonStart.addEventListener("click", function () {
        if (intervalleTimer !== null) {
            clearInterval(intervalleTimer); intervalleTimer = null;
            boutonStart.textContent = "▶ Reprendre";
            boutonStart.classList.replace("btn-pause", "btn-start"); return;
        }
        if (secondesRestantes === 0) {
            var heures   = parseInt(document.getElementById("hours").value)   || 0;
            var minutes  = parseInt(document.getElementById("minutes").value) || 0;
            var secondes = parseInt(document.getElementById("seconds").value) || 0;
            secondesRestantes = heures * 3600 + minutes * 60 + secondes;
            secondesTotales   = secondesRestantes;
        }
        if (secondesRestantes <= 0) return;
        boutonStart.textContent = "⏸ Pause";
        boutonStart.classList.replace("btn-start", "btn-pause");
        entrerModeFocus(); mettreAJourAnneau();
        intervalleTimer = setInterval(function () {
            secondesRestantes--;
            mettreAJourAnneau();
            var h = Math.floor(secondesRestantes / 3600);
            var m = Math.floor((secondesRestantes % 3600) / 60);
            var s = secondesRestantes % 60;
            document.getElementById("timerDisplay").textContent =
                String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
            if (secondesRestantes <= 0) {
                clearInterval(intervalleTimer);
                intervalleTimer = null; secondesRestantes = 0; secondesTotales = 0;
                document.getElementById("timerDisplay").textContent = "00:00:00";
                boutonStart.textContent = "▶ Démarrer";
                boutonStart.classList.replace("btn-pause", "btn-start");
                quitterModeFocus();
                alert("🎉 Session Focus terminée ! Bien joué !");
            }
        }, 1000);
    });

    document.getElementById("btnReset2").addEventListener("click", function () {
        clearInterval(intervalleTimer);
        intervalleTimer = null; secondesRestantes = 0; secondesTotales = 0;
        document.getElementById("timerDisplay").textContent = "00:00:00";
        boutonStart.textContent = "▶ Démarrer";
        boutonStart.classList.remove("btn-pause");
        boutonStart.classList.add("btn-start");
        var anneau = document.getElementById("ring");
        anneau.style.strokeDasharray  = CIRCONFERENCE;
        anneau.style.strokeDashoffset = 0;
        quitterModeFocus();
    });

    // ── UTILITAIRES ──
    function formaterDate(chaine) {
        if (!chaine) return "";
        var p = chaine.split("-");
        return p[2] + "/" + p[1] + "/" + p[0];
    }
    window._formaterDate = formaterDate;

});

