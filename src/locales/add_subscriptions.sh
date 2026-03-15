#!/bin/bash

# Add subscriptions section to es.json (Spanish)
jq '. + {"subscriptions": {
  "title": "Suscripciones",
  "yourPlan": "Tu Plan",
  "currentPlan": "Plan Actual",
  "scansPerMonth": "{{count}} escaneos por mes",
  "emailSupport": "Soporte por email",
  "prioritySupport": "Soporte prioritario",
  "unlimitedScans": "Escaneos ilimitados",
  "dedicatedSupport": "Soporte dedicado",
  "errorLoading": "Error al cargar la suscripción",
  "loginRequired": "Debes iniciar sesión para suscribirte",
  "errorCheckout": "Error al crear la sesión de pago",
  "comingSoon": "Próximamente",
  "comingSoonDesc": "Esta función estará disponible pronto",
  "scansUsed": "Escaneos Utilizados",
  "productsSaved": "Productos Guardados",
  "invoicesThisMonth": "Facturas Este Mes",
  "manageSubscription": "Gestionar Suscripción",
  "choosePlan": "Elige Tu Plan",
  "popular": "Popular",
  "month": "mes",
  "upgradeToThisPlan": "Actualizar a Este Plan"
}}' es.json > es.json.tmp && mv es.json.tmp es.json

# Add subscriptions section to fr.json (French)
jq '. + {"subscriptions": {
  "title": "Abonnements",
  "yourPlan": "Votre Plan",
  "currentPlan": "Plan Actuel",
  "scansPerMonth": "{{count}} scans par mois",
  "emailSupport": "Support par email",
  "prioritySupport": "Support prioritaire",
  "unlimitedScans": "Scans illimités",
  "dedicatedSupport": "Support dédié",
  "errorLoading": "Erreur lors du chargement de l'\''abonnement",
  "loginRequired": "Vous devez être connecté pour vous abonner",
  "errorCheckout": "Erreur lors de la création de la session de paiement",
  "comingSoon": "Bientôt disponible",
  "comingSoonDesc": "Cette fonctionnalité sera bientôt disponible",
  "scansUsed": "Scans Utilisés",
  "productsSaved": "Produits Enregistrés",
  "invoicesThisMonth": "Factures Ce Mois",
  "manageSubscription": "Gérer l'\''Abonnement",
  "choosePlan": "Choisissez Votre Plan",
  "popular": "Populaire",
  "month": "mois",
  "upgradeToThisPlan": "Passer à Ce Plan"
}}' fr.json > fr.json.tmp && mv fr.json.tmp fr.json

# Add subscriptions section to de.json (German)
jq '. + {"subscriptions": {
  "title": "Abonnements",
  "yourPlan": "Ihr Plan",
  "currentPlan": "Aktueller Plan",
  "scansPerMonth": "{{count}} Scans pro Monat",
  "emailSupport": "E-Mail-Support",
  "prioritySupport": "Prioritäts-Support",
  "unlimitedScans": "Unbegrenzte Scans",
  "dedicatedSupport": "Dedizierter Support",
  "errorLoading": "Fehler beim Laden des Abonnements",
  "loginRequired": "Sie müssen angemeldet sein, um sich zu abonnieren",
  "errorCheckout": "Fehler beim Erstellen der Checkout-Sitzung",
  "comingSoon": "Demnächst",
  "comingSoonDesc": "Diese Funktion wird bald verfügbar sein",
  "scansUsed": "Verwendete Scans",
  "productsSaved": "Gespeicherte Produkte",
  "invoicesThisMonth": "Rechnungen Diesen Monat",
  "manageSubscription": "Abonnement Verwalten",
  "choosePlan": "Wählen Sie Ihren Plan",
  "popular": "Beliebt",
  "month": "Monat",
  "upgradeToThisPlan": "Auf Diesen Plan Upgraden"
}}' de.json > de.json.tmp && mv de.json.tmp de.json

# Add subscriptions section to lt.json (Lithuanian)
jq '. + {"subscriptions": {
  "title": "Prenumeratos",
  "yourPlan": "Jūsų Planas",
  "currentPlan": "Dabartinis Planas",
  "scansPerMonth": "{{count}} skenavimų per mėnesį",
  "emailSupport": "El. pašto palaikymas",
  "prioritySupport": "Prioritetinis palaikymas",
  "unlimitedScans": "Neriboti skenavimai",
  "dedicatedSupport": "Dedikuotas palaikymas",
  "errorLoading": "Klaida įkeliant prenumeratą",
  "loginRequired": "Turite prisijungti, kad prenumeruotumėte",
  "errorCheckout": "Klaida kuriant mokėjimo sesiją",
  "comingSoon": "Netrukus",
  "comingSoonDesc": "Ši funkcija bus prieinama netrukus",
  "scansUsed": "Panaudoti Skenavimai",
  "productsSaved": "Išsaugoti Produktai",
  "invoicesThisMonth": "Sąskaitos Šį Mėnesį",
  "manageSubscription": "Valdyti Prenumeratą",
  "choosePlan": "Pasirinkite Savo Planą",
  "popular": "Populiarus",
  "month": "mėnuo",
  "upgradeToThisPlan": "Pereiti Prie Šio Plano"
}}' lt.json > lt.json.tmp && mv lt.json.tmp lt.json

echo "✅ Subscriptions section added to all language files"
