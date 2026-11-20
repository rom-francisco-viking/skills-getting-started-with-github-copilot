document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]);
  }

  function createParticipantItem(activityName, participant) {
    return `
      <li>
        <span class="participant-email">${escapeHtml(participant)}</span>
        <button
          type="button"
          class="delete-participant"
          data-activity="${escapeHtml(activityName)}"
          data-email="${escapeHtml(participant)}"
          aria-label="Unregister ${escapeHtml(participant)}"
          title="Unregister participant"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 10H8L7 9Zm3 2v6h2v-6h-2Zm4 0v6h2v-6h-2Z"/>
          </svg>
        </button>
      </li>
    `;
  }

  function updateActivityParticipant(activityName, email, action) {
    const activityCard = Array.from(document.querySelectorAll(".activity-card"))
      .find((card) => card.dataset.activityName === activityName);

    if (!activityCard) {
      return;
    }

    const participantsSection = activityCard.querySelector(".participants");
    let participantsList = participantsSection.querySelector("ul");

    if (action === "add") {
      const existingParticipant = Array.from(participantsSection.querySelectorAll(".delete-participant"))
        .some((button) => button.dataset.email === email);
      if (existingParticipant) {
        return;
      }

      participantsSection.querySelector(".no-participants")?.remove();
      if (!participantsList) {
        participantsList = document.createElement("ul");
        participantsSection.appendChild(participantsList);
      }

      const template = document.createElement("template");
      template.innerHTML = createParticipantItem(activityName, email);
      participantsList.appendChild(template.content.firstElementChild);
    } else {
      const deleteButton = Array.from(participantsSection.querySelectorAll(".delete-participant"))
        .find((button) => button.dataset.email === email);
      deleteButton?.closest("li")?.remove();

      if (!participantsSection.querySelector("li")) {
        participantsList?.remove();
        if (!participantsSection.querySelector(".no-participants")) {
          const emptyMessage = document.createElement("p");
          emptyMessage.className = "no-participants";
          emptyMessage.textContent = "No participants yet";
          participantsSection.appendChild(emptyMessage);
        }
      }
    }

    const availabilityParagraph = Array.from(activityCard.querySelectorAll("p"))
      .find((paragraph) => paragraph.textContent.includes("Availability"));
    if (availabilityParagraph) {
      const match = availabilityParagraph.textContent.match(/(\d+) spots left/);
      if (match) {
        const change = action === "add" ? -1 : 1;
        const spotsLeft = Math.max(0, Number.parseInt(match[1], 10) + change);
        availabilityParagraph.innerHTML = `<strong>Availability:</strong> ${spotsLeft} spots left`;
      }
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        activityCard.dataset.activityName = name;

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsList = details.participants.length
          ? `<ul>${details.participants
              .map((participant) => createParticipantItem(name, participant))
              .join("")}</ul>`
          : '<p class="no-participants">No participants yet</p>';

        activityCard.innerHTML = `
          <h4>${escapeHtml(name)}</h4>
          <p>${escapeHtml(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHtml(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants">
            <strong>Participants:</strong>
            ${participantsList}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        updateActivityParticipant(activity, email, "add");
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Handle participant removal
  activitiesList.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest(".delete-participant");
    if (!deleteButton) {
      return;
    }

    const activity = deleteButton.dataset.activity;
    const email = deleteButton.dataset.email;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        updateActivityParticipant(activity, email, "remove");
        await fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "Failed to unregister participant";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister participant.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering participant:", error);
    }
  });

  // Initialize app
  fetchActivities();
});
