// Example authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required' 
    });
  }

  // In a real application, you'd verify the JWT token here
  // For now, this is just a placeholder
  console.log('Token received:', token);
  
  // Mock user data
  req.user = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com'
  };

  next();
};

module.exports = {
  authenticateToken
};