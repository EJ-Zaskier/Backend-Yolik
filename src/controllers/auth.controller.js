const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
        return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
  
    // Verificar si email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(409).json({ message: 'El email ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
        email,
        name,
        passwordHash: hash  // Solo guardar campos necesarios, no usar ...req.body
    });
    
    // NO devolver el usuario completo, solo datos públicos
    res.status(201).json({
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
    });
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    // Validar entrada
    if (!email || !password) {
        return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no existe' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
        { 
            id: user._id, 
            role: user.role,
            email: user.email  
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.json({
        token,
        user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role
        }
    });
};