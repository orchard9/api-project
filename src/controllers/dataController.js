// Example controller for handling data operations
class DataController {
  static getAllData(req, res) {
    try {
      const mockData = [
        { id: 1, title: 'Sample Data 1', description: 'This is sample data', createdAt: new Date() },
        { id: 2, title: 'Sample Data 2', description: 'This is more sample data', createdAt: new Date() },
        { id: 3, title: 'Sample Data 3', description: 'Even more sample data', createdAt: new Date() }
      ];

      res.json({
        success: true,
        data: mockData,
        count: mockData.length,
        message: 'Data retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static getDataById(req, res) {
    try {
      const { id } = req.params;
      const mockData = {
        id: parseInt(id),
        title: `Sample Data ${id}`,
        description: `This is sample data with ID ${id}`,
        createdAt: new Date()
      };

      res.json({
        success: true,
        data: mockData,
        message: 'Data retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static createData(req, res) {
    try {
      const { title, description } = req.body;
      
      if (!title || !description) {
        return res.status(400).json({
          success: false,
          error: 'Title and description are required'
        });
      }

      const newData = {
        id: Date.now(), // Simple ID generation for demo
        title,
        description,
        createdAt: new Date()
      };

      res.status(201).json({
        success: true,
        data: newData,
        message: 'Data created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = DataController;