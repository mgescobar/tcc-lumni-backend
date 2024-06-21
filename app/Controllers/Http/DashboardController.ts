import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Option from 'App/Models/Option'
import Answer from 'App/Models/Answer'  
import Player from 'App/Models/Player'
import Database from '@ioc:Adonis/Lucid/Database'
export default class DashboardController {
  public async numberOfQuestionsByThemes({ response }: HttpContextContract) {
    const numberOfQuestionsByThemes = await Database
                            .query()
                            .select('theme')
                            .from('problems')
                            .count('*', 'questions')
                            .groupBy('theme')
                            .orderBy('theme', 'asc')

    const total = await Database
                          .query() 
                          .count('*','total')
                          .from('problems')                          

    return response.ok({ numberOfQuestionsByThemes, total: total[0].total})
  }

  public async numberOfQuestionsByLevel ({ response }: HttpContextContract) {
    const levels = await Database
                          .query()
                          .select('level')
                          .count('*','numberOfQuestions')
                          .from('problems')
                          .groupBy('level')
                          .orderBy('level', 'asc')

    const total = await Database
                        .query() 
                        .count('*','total')
                        .from('problems')    

    return response.ok({ levels, total: total[0].total })
  }

  public async answersStatsByThemes ({ response }: HttpContextContract) {
    const answerStatsByTheme = await Database
      .query()
      .select('theme')
      .from('problems')
      .count('*', 'numberOfQuestions')
      .groupBy('theme')
      .orderBy('theme', 'asc')
      .then(async (themes) => {
        const answerStatsByTheme = await Promise.all(
          themes.map(async (theme) => {
            const numberOfAnswersByTheme = await Database
              .query()
              .select('problem_id')
              .from('answers')
              .where('problem_id', 'in', Database
                .query()
                .select('id')
                .from('problems')
                .where('theme', theme.theme)
              )
              .count('*', 'numberOfAnswersByTheme')
              .groupBy('problem_id')
              .orderBy('problem_id', 'asc')
            const numberOfAnswersByThemeTotal = numberOfAnswersByTheme.reduce((acc, cur) => acc + cur.numberOfAnswersByTheme, 0)
            const correctAnswers = await Database
              .query()
              .select('problem_id')
              .from('answers')
              .where('option_id', 'in', Database
                .query()
                .select('id')
                .from('options')
                .where('correct', 1)
              )
              .where('problem_id', 'in', Database
                .query()
                .select('id')
                .from('problems')
                .where('theme', theme.theme)
              )
              .count('*', 'correctAnswers')
              .groupBy('problem_id')
              .orderBy('problem_id', 'asc')
            const correctAnswersTotal = correctAnswers.reduce((acc, cur) => acc + cur.correctAnswers, 0)
            const wrongAnswers = numberOfAnswersByThemeTotal - correctAnswersTotal
            return { theme: theme.theme, numberOfQuestions: theme.numberOfQuestions, numberOfAnswersByTheme: numberOfAnswersByThemeTotal, correctAnswers: correctAnswersTotal, wrongAnswers }
          })
        )
        return answerStatsByTheme
      })
    return response.ok({ answerStatsByTheme })
  }

  public async answersByPlayer ({ response, request}: HttpContextContract) {
    const player_id = request.param('id')    
    const player = await Player.findOrFail(player_id)
    const answers = await Answer.query().where('player_id', player.id)
    const options = await Promise.all(
      answers.map(async (answer) => {
        return await Option.query().where('id', answer.option_id)
      })
    )
    const correctAnswers = options
      .flat()
      .filter((option) => option.correct === 1).length
    const wrongAnswers = options
      .flat()
      .filter((option) => option.correct === 0).length
    const average = parseFloat(((correctAnswers / (correctAnswers + wrongAnswers)) * 100).toFixed(2));

    
    const playerData = {...player.$attributes, correctAnswers, wrongAnswers, average }
    return response.ok(playerData)
  }

  public async getAccessesByDayOfWeek({ request, response }: HttpContextContract) {
    const userId = request.input('user_id')

    let query = Database
      .from(Database.raw(`
        (SELECT 0 AS day_of_week, 'Domingo' AS day_name UNION ALL
         SELECT 1, 'Segunda-feira' UNION ALL
         SELECT 2, 'Terça-feira' UNION ALL
         SELECT 3, 'Quarta-feira' UNION ALL
         SELECT 4, 'Quinta-feira' UNION ALL
         SELECT 5, 'Sexta-feira' UNION ALL
         SELECT 6, 'Sábado') as days
      `))
      .leftJoin('api_tokens as a', Database.raw('days.day_of_week = EXTRACT(DOW FROM a.created_at)'))
      .select('days.day_name as day_of_week')
      .count('a.id as count')
      .groupBy('days.day_of_week', 'days.day_name')
      .orderBy(Database.raw(`
        CASE
          WHEN days.day_of_week = 0 THEN 7
          ELSE days.day_of_week
        END
      `))

    if (userId) {
      query = query.where('a.user_id', userId)
    }

    const accesses = await query

    const formattedAccesses = accesses.map(access => ({
      "Dia da semana": access.day_of_week,
      "Número de acessos": Number(access.count)
    }))

    return response.json(formattedAccesses)
  }

  public async statsByQuestionLvl({ request, response }: HttpContextContract) {
    const { player_id, theme, problem_id } = request.only(['player_id', 'theme', 'problem_id'])

    const bindings: any = {}

    let whereClause = ''
    if (player_id) {
      whereClause += ' AND answers.player_id = :player_id'
      bindings.player_id = player_id
    }

    if (theme) {
      whereClause += ' AND problems.theme = :theme'
      bindings.theme = theme
    }

    if (problem_id) {
      whereClause += ' AND answers.problem_id = :problem_id'
      bindings.problem_id = problem_id
    }

    const query = `
      SELECT 
          CASE
              WHEN problems.level = 1 THEN 'Fácil'
              WHEN problems.level = 2 THEN 'Intermediário'
              WHEN problems.level = 3 THEN 'Difícil'
          END AS "Dificuldade",
          SUM(CASE WHEN options.correct = 1 THEN 1 ELSE 0 END) AS "Acertos",
          SUM(CASE WHEN options.correct = 0 THEN 1 ELSE 0 END) AS "Erros",
          ROUND(AVG(answers.used_time)) AS "Tempo Médio (segundos)"
      FROM answers
      JOIN problems ON answers.problem_id = problems.id
      JOIN options ON answers.option_id = options.id
      WHERE 1=1 ${whereClause}
      GROUP BY problems.level
      ORDER BY problems.level DESC;
    `

    const stats = await Database.rawQuery(query, bindings)

    const formattedStats = stats.rows.map(row => ({
      ...row,
      'Acertos': parseInt(row['Acertos']),
      'Erros': parseInt(row['Erros']),
      'Tempo Médio (segundos)': parseFloat(row['Tempo Médio (segundos)'])
    }))

    return response.json(formattedStats)
  }
}
