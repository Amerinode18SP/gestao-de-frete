const express = require('express')
const router  = express.Router()
const c = require('../controllers/manutencao')

router.get('/',                   c.listar)
router.get('/dashboard/resumo',   c.resumoDash)
router.get('/dashboard/rankings', c.rankingsDash)
router.get('/dashboard/serie',    c.serieDash)
router.get('/:id',                c.buscarPorId)
router.post('/',                  c.criar)
router.post('/:id/converter',     c.converterEmOrdem)
router.put('/:id',                c.atualizar)
router.delete('/:id',             c.excluir)

module.exports = router
