import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Player from 'App/Models/Player'
import Level from 'App/Models/Level'
import Database from '@ioc:Adonis/Lucid/Database';

export default class PlayersController {
  public async store({ request, response }: HttpContextContract) {
    const playerPayload = request.all()
    const player = new Player()
    player.merge(playerPayload)
    await player.save()
    return response.ok({ player })
  }
  
  public async update({ request, response }: HttpContextContract) {
    const playerPayload = request.all()
    const player = await Player.findByOrFail('id', request.param('id'))
    player.merge(playerPayload)
    await player.save()
    return response.ok({ player })
  }
  
  public async delete({ request, response }: HttpContextContract) {
    const player = await Player.findByOrFail('id', request.param('id'))
    await player.delete()
    return response.ok({ player })
  }
  
  public async findPlayer({ request, response }: HttpContextContract) {
    const playerFind = await Player.findByOrFail('id', request
      .param('id'))
    
    const level = await Level.findByOrFail('level', playerFind.player_level)
    const player ={...playerFind.$attributes, player_rank: level.$attributes.description }
    
    return response.ok({ player })
  }

  public async findAll({ response }: HttpContextContract) {
    const players = await Player.all()
    return response.ok({ players })
  }

  public async highscore({ response }: HttpContextContract) {
    const Highscore = await Database.rawQuery(`SELECT p.id, p.user_id, u.name, p.player_level as level, l.description as rank, p.score
    FROM players p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN levels l ON l.level = p.player_level
    ORDER BY p.score DESC`)

    const players = Highscore.rows

    return response.ok({ players })
  }

  public async addScore({ request, response }: HttpContextContract) {
    const player = await Player.findByOrFail('id', request.param('id'))
    const score = request.input('addScore')
    player.score = player.score + score
    await player.save()
    return response.ok({ player })
  }
}
