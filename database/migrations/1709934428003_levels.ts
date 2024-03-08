import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'levels'

  public async up () {
    this.schema.createTable(this.tableName, (table) => {
      // Bit-biter - Noob - Bixo - Script Kiddie - Veterano - Nerd - Try Harder - Scrum Master
      table.increments('id')
      table.string('description', 255).notNullable()
    })
  }

  public async down () {
    this.schema.dropTable(this.tableName)
  }
}
