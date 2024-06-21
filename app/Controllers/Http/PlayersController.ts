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
    const players = await Database
      .from('players')
      .join('users', 'players.user_id', 'users.id')
      .select(
        'players.id as player_id',
        'players.user_id',
        'players.ranking',
        'players.score',
        'players.player_level',
        'players.created_at',
        'players.updated_at',
        'users.id as user_id',
        'users.name as user_name'
      )

    const formattedPlayers = players.map((player) => {
      return {
        id: player.player_id,
        user_id: player.user_id,
        ranking: player.ranking,
        score: player.score,
        player_level: player.player_level,
        created_at: player.created_at,
        updated_at: player.updated_at,
        name: player.user_name
      }
    })

    return response.ok({ players: formattedPlayers })
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

    // Calc do nivel com base no score
    // serve para ir aumento a dificuldade de se obter o proximo nivel
    const valorInicial = 100;
    const multiplicador = 2;
    let nivel = 1;
    let pontuacaoNecessaria = valorInicial;
  
    while (player.score >= pontuacaoNecessaria) {
        nivel++;
        pontuacaoNecessaria *= multiplicador;
    }
    player.player_level = nivel
    await player.save()
    return response.ok({ player })
  }
}
