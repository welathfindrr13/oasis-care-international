// Mock API for demonstration
export const fetcher = async (url: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock response for /stats/today
  if (url === '/stats/today') {
    return {
      booked: Math.floor(Math.random() * 20) + 5,
      finished: Math.floor(Math.random() * 15) + 3,
    };
  }
  
  throw new Error('Not found');
};

// Use this in production:
// export const fetcher = (url: string) =>
//   fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
//     credentials: 'include',
//   }).then((r) => {
//     if (!r.ok) {
//       throw new Error('Failed to fetch');
//     }
//     return r.json();
//   });
