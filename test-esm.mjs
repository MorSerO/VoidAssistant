import electron from 'electron';
console.log("typeof:", typeof electron);
console.log("sample:", typeof electron === 'object' ? Object.keys(electron).slice(0,5) : electron.slice(0,80));
