const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameSchema = new Schema({
  _id:{type:String, unique:true, required:true},
  white_id:String,
  black_id:String,
  game:Array,
  result:String,
  moves:String
});


const Game = mongoose.model('Game', gameSchema);
module.exports = Game;