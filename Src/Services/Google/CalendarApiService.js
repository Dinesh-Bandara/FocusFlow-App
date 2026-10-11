export const CalendarApiService = {

  fetchUpcomingEvents: async (accessToken) => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const timeMin = startOfDay.toISOString();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const timeMax = endOfDay.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&orderBy=startTime&singleEvents=true`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Calendar API Failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Calendar API Error:", error);
      throw error; // Bubble up
    }
  }
};
