const regex = /^[A-Za-z]:[^/\\]/;
console.log('Test C:Usersfoo:', regex.test('C:Usersfoo'));
console.log('Test C:/Usersfoo:', regex.test('C:/Usersfoo'));
console.log('Test C:\\Usersfoo:', regex.test('C:\\Usersfoo'));
