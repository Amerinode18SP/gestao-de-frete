const express = require('express')
const router  = express.Router()
const { resumo, rankings, serie } = require('../controllers/outros')
router.get('/resumo',   resumo)
router.get('/rankings', rankings)
router.get('/serie',    serie)
module.exports = router
