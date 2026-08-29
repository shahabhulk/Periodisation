export interface FallbackExercise {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
}

export const FALLBACK_EXERCISES: FallbackExercise[] = [
  // CHEST
  {
    exerciseId: "fb-1",
    name: "Barbell Bench Press",
    gifUrl: "https://v2.exercisedb.io/image/9Z7K6xL2Lp6q2O",
    bodyParts: ["chest"],
    equipments: ["barbell"],
    targetMuscles: ["pectorals"],
    secondaryMuscles: ["triceps", "anterior deltoids"],
    instructions: ["Lie flat on the bench.", "Grasp barbell slightly wider than shoulder width.", "Lower bar smoothly to chest.", "Press explosive upward until arms are extended."]
  },
  {
    exerciseId: "fb-2",
    name: "Incline Dumbbell Press",
    gifUrl: "https://v2.exercisedb.io/image/9Z7K6xL2Lp6q2P",
    bodyParts: ["chest"],
    equipments: ["dumbbell"],
    targetMuscles: ["upper pectorals"],
    secondaryMuscles: ["front deltoids", "triceps"],
    instructions: ["Set bench to 30-45 degree incline.", "Press dumbbells up vertically over chest.", "Lower controlled until elbows form 90 degrees."]
  },
  {
    exerciseId: "fb-3",
    name: "Cable Chest Fly",
    gifUrl: "",
    bodyParts: ["chest"],
    equipments: ["cable"],
    targetMuscles: ["pectorals"],
    secondaryMuscles: ["anterior deltoids"],
    instructions: ["Stand in center of cable pulleys.", "Pull handles forward with a slight elbow bend until hands touch."]
  },
  {
    exerciseId: "fb-4",
    name: "Dips for Chest",
    gifUrl: "",
    bodyParts: ["chest"],
    equipments: ["body weight"],
    targetMuscles: ["lower pectorals"],
    secondaryMuscles: ["triceps"],
    instructions: ["Lean slightly forward on parallel bars.", "Lower body until shoulders are below elbows.", "Push up to starting position."]
  },
  {
    exerciseId: "fb-5",
    name: "Push-ups",
    gifUrl: "",
    bodyParts: ["chest"],
    equipments: ["body weight"],
    targetMuscles: ["pectorals"],
    secondaryMuscles: ["triceps", "core"],
    instructions: ["Place hands shoulder-width apart.", "Keep body in straight plank.", "Lower chest to ground and push back up."]
  },

  // BACK
  {
    exerciseId: "fb-6",
    name: "Barbell Deadlift",
    gifUrl: "",
    bodyParts: ["back"],
    equipments: ["barbell"],
    targetMuscles: ["erector spinae", "glutes", "hamstrings"],
    secondaryMuscles: ["lats", "traps", "forearms"],
    instructions: ["Stand with feet hip-width under bar.", "Hinge hips and grip bar.", "Drive through feet, locking out hips and knees together."]
  },
  {
    exerciseId: "fb-7",
    name: "Lat Pulldown",
    gifUrl: "",
    bodyParts: ["back"],
    equipments: ["cable"],
    targetMuscles: ["latissimus dorsi"],
    secondaryMuscles: ["biceps", "rhomboids"],
    instructions: ["Grip lat bar wide.", "Pull bar down towards upper chest while arching upper back.", "Return slowly to top stretch."]
  },
  {
    exerciseId: "fb-8",
    name: "Barbell Bent Over Row",
    gifUrl: "",
    bodyParts: ["back"],
    equipments: ["barbell"],
    targetMuscles: ["latissimus dorsi", "rhomboids"],
    secondaryMuscles: ["biceps", "posterior deltoids"],
    instructions: ["Hinge forward at 45 degrees.", "Row bar towards lower ribcage.", "Squeeze shoulder blades together."]
  },
  {
    exerciseId: "fb-9",
    name: "Pull-ups",
    gifUrl: "",
    bodyParts: ["back"],
    equipments: ["body weight"],
    targetMuscles: ["latissimus dorsi"],
    secondaryMuscles: ["biceps", "core"],
    instructions: ["Grip pull-up bar overhead.", "Pull chest up to bar level.", "Lower down under control."]
  },
  {
    exerciseId: "fb-10",
    name: "Seated Cable Row",
    gifUrl: "",
    bodyParts: ["back"],
    equipments: ["cable"],
    targetMuscles: ["middle back", "rhomboids"],
    secondaryMuscles: ["lats", "biceps"],
    instructions: ["Sit with feet firmly on pads.", "Pull handle to torso while keeping chest tall."]
  },

  // SHOULDERS
  {
    exerciseId: "fb-11",
    name: "Overhead Barbell Press",
    gifUrl: "",
    bodyParts: ["shoulders"],
    equipments: ["barbell"],
    targetMuscles: ["anterior deltoids", "lateral deltoids"],
    secondaryMuscles: ["triceps", "core"],
    instructions: ["Rest bar on upper chest.", "Press straight overhead to full lock-out.", "Lower controlled to collarbone."]
  },
  {
    exerciseId: "fb-12",
    name: "Dumbbell Lateral Raise",
    gifUrl: "",
    bodyParts: ["shoulders"],
    equipments: ["dumbbell"],
    targetMuscles: ["lateral deltoids"],
    secondaryMuscles: ["traps"],
    instructions: ["Hold dumbbells at sides.", "Raise arms out sideways until parallel to floor.", "Lower slowly."]
  },
  {
    exerciseId: "fb-13",
    name: "Seated Dumbbell Shoulder Press",
    gifUrl: "",
    bodyParts: ["shoulders"],
    equipments: ["dumbbell"],
    targetMuscles: ["anterior deltoids"],
    secondaryMuscles: ["triceps"],
    instructions: ["Sit on upright bench.", "Press dumbbells overhead until arms are extended."]
  },
  {
    exerciseId: "fb-14",
    name: "Face Pulls",
    gifUrl: "",
    bodyParts: ["shoulders"],
    equipments: ["cable"],
    targetMuscles: ["rear deltoids", "rotator cuff"],
    secondaryMuscles: ["upper traps"],
    instructions: ["Attach rope to high cable.", "Pull rope towards forehead, flaring elbows out."]
  },

  // UPPER ARMS
  {
    exerciseId: "fb-15",
    name: "Barbell Bicep Curl",
    gifUrl: "",
    bodyParts: ["upper arms"],
    equipments: ["barbell"],
    targetMuscles: ["biceps brachii"],
    secondaryMuscles: ["forearms"],
    instructions: ["Stand tall holding barbell underhand.", "Curl bar up keeping elbows tucked in."]
  },
  {
    exerciseId: "fb-16",
    name: "EZ-Bar Preacher Curl",
    gifUrl: "",
    bodyParts: ["upper arms"],
    equipments: ["ez barbell"],
    targetMuscles: ["biceps brachii"],
    secondaryMuscles: ["brachialis"],
    instructions: ["Rest arms on preacher pad.", "Curl EZ-bar upwards squeezing biceps."]
  },
  {
    exerciseId: "fb-17",
    name: "Tricep Rope Pushdown",
    gifUrl: "",
    bodyParts: ["upper arms"],
    equipments: ["cable"],
    targetMuscles: ["triceps brachii"],
    secondaryMuscles: ["forearms"],
    instructions: ["Grip rope attachment at chest level.", "Push rope down extending elbows fully."]
  },
  {
    exerciseId: "fb-18",
    name: "Skull Crushers (Lying Tricep Extension)",
    gifUrl: "",
    bodyParts: ["upper arms"],
    equipments: ["ez barbell"],
    targetMuscles: ["triceps brachii"],
    secondaryMuscles: ["shoulders"],
    instructions: ["Lie flat on bench holding bar overhead.", "Bend elbows to lower bar towards forehead.", "Extend back up."]
  },
  {
    exerciseId: "fb-19",
    name: "Incline Dumbbell Curl",
    gifUrl: "",
    bodyParts: ["upper arms"],
    equipments: ["dumbbell"],
    targetMuscles: ["biceps brachii"],
    secondaryMuscles: ["forearms"],
    instructions: ["Sit on incline bench letting arms hang.", "Curl dumbbells up with full range of motion."]
  },

  // UPPER LEGS
  {
    exerciseId: "fb-20",
    name: "Barbell Back Squat",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["barbell"],
    targetMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings", "core", "lower back"],
    instructions: ["Place bar across upper traps.", "Squat down keeping knees over toes until thighs parallel.", "Drive up through heels."]
  },
  {
    exerciseId: "fb-21",
    name: "Romanian Deadlift",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["barbell"],
    targetMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["erector spinae"],
    instructions: ["Hold bar at thigh height.", "Hinge at hips pushing glutes backward with soft knees.", "Lower until hamstring stretch then return."]
  },
  {
    exerciseId: "fb-22",
    name: "Leg Press",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["lever machine"],
    targetMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
    instructions: ["Sit in leg press machine with feet shoulder-width.", "Release safety and bend knees to 90 degrees.", "Press platform back."]
  },
  {
    exerciseId: "fb-23",
    name: "Walking Dumbbell Lunge",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["dumbbell"],
    targetMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings", "calves"],
    instructions: ["Step forward into a lunge until back knee touches near floor.", "Push up and step forward with opposite leg."]
  },
  {
    exerciseId: "fb-24",
    name: "Leg Extension",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["lever machine"],
    targetMuscles: ["quadriceps"],
    instructions: ["Sit in extension machine with pad on lower shins.", "Extend knees fully to squeeze quads."]
  },
  {
    exerciseId: "fb-25",
    name: "Lying Leg Curl",
    gifUrl: "",
    bodyParts: ["upper legs"],
    equipments: ["lever machine"],
    targetMuscles: ["hamstrings"],
    instructions: ["Lie face down on leg curl machine.", "Curl pad up towards glutes."]
  },

  // LOWER LEGS
  {
    exerciseId: "fb-26",
    name: "Standing Calf Raise",
    gifUrl: "",
    bodyParts: ["lower legs"],
    equipments: ["smith machine"],
    targetMuscles: ["gastrocnemius"],
    secondaryMuscles: ["soleus"],
    instructions: ["Stand on step edge with balls of feet.", "Lower heels down into deep stretch.", "Press up high onto toes."]
  },
  {
    exerciseId: "fb-27",
    name: "Seated Calf Raise",
    gifUrl: "",
    bodyParts: ["lower legs"],
    equipments: ["lever machine"],
    targetMuscles: ["soleus"],
    instructions: ["Place pad over knees while seated.", "Raise heels up slowly, then lower fully."]
  },

  // WAIST / CORE
  {
    exerciseId: "fb-28",
    name: "Hanging Leg Raise",
    gifUrl: "",
    bodyParts: ["waist"],
    equipments: ["body weight"],
    targetMuscles: ["rectus abdominis"],
    secondaryMuscles: ["hip flexors"],
    instructions: ["Hang from pull-up bar.", "Raise legs up to 90 degrees or touch toes to bar."]
  },
  {
    exerciseId: "fb-29",
    name: "Cable Ab Crunch",
    gifUrl: "",
    bodyParts: ["waist"],
    equipments: ["cable"],
    targetMuscles: ["rectus abdominis"],
    instructions: ["Kneel facing high pulley with rope at head.", "Flex spine downward pulling elbows towards knees."]
  },
  {
    exerciseId: "fb-30",
    name: "Plank",
    gifUrl: "",
    bodyParts: ["waist"],
    equipments: ["body weight"],
    targetMuscles: ["core", "transverse abdominis"],
    instructions: ["Hold push-up position on forearms.", "Keep body in straight line engaging core."]
  },

  // CARDIO
  {
    exerciseId: "fb-31",
    name: "Treadmill Run / Jog",
    gifUrl: "",
    bodyParts: ["cardio"],
    equipments: ["lever machine"],
    targetMuscles: ["cardiovascular system"],
    instructions: ["Maintain steady rhythm on treadmill belt."]
  },
  {
    exerciseId: "fb-32",
    name: "Rowing Machine",
    gifUrl: "",
    bodyParts: ["cardio"],
    equipments: ["lever machine"],
    targetMuscles: ["cardiovascular system", "full body"],
    instructions: ["Drive back with legs, lean slightly back, pull handle to chest."]
  }
];
