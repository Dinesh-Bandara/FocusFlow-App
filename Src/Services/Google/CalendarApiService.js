export const CalendarApiService = {
  /**
   * Fetch calendar events within a given date window, expanding recurring events
   * into individual occurrences (singleEvents=true) and handling pagination.
   */
  fetchUpcomingEvents: async (accessToken, customMinDate = null, customMaxDate = null) => {
    try {
      const minDate = customMinDate || new Date(Date.now() - 14 * 86400000); // 14 days ago
      minDate.setHours(0, 0, 0, 0);
      const timeMin = minDate.toISOString();

      const maxDate = customMaxDate || new Date(Date.now() + 30 * 86400000); // 30 days ahead
      maxDate.setHours(23, 59, 59, 999);
      const timeMax = maxDate.toISOString();

      let allItems = [];
      let pageToken = null;

      do {
        let url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&orderBy=startTime&singleEvents=true&maxResults=250`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Calendar API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const items = (data.items || []).filter(item => item.status !== 'cancelled');
        allItems = allItems.concat(items);
        pageToken = data.nextPageToken || null;
      } while (pageToken);

      return allItems;
    } catch (error) {
      console.error('Calendar API Error:', error);
      throw error;
    }
  },
};
