<template>
  <label class="label">
    <p>{{ (label ?? field.fieldName) || label }}:</p>

    <input :type="inputType" v-model="vModel"/>
  </label>
</template>

<script setup>
  import { computed } from 'vue'
  import { useFieldPath } from './use_field_path'

  const
    props = defineProps({
      label: String,
      field: Object,
      fieldPath: String
    }),
    { vModel } = useFieldPath(props),
    inputType = computed(() => {
      switch(props.field.type) {
        case "int32":
        case "uint32":
        case "float":
          return "number"
        case "bool":
          return "checkbox"
        default:
          return "text"
      }
    })

</script>
