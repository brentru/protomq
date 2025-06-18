<template>
  <RepeatedFieldInput v-if="isRepeated" :field="field" :fieldPath="fieldPath"/>
  <InputComponent v-else :field="field" :fieldPath="fieldPath"/>
</template>

<script setup>
  import { computed } from 'vue'
  import OneofInput from './OneofInput.vue'
  import EnumInput from './EnumInput.vue'
  import MessageInput from './MessageInput.vue'
  import PrimitiveInput from './PrimitiveInput.vue'
  import RepeatedFieldInput from './RepeatedFieldInput.vue'

  const
    props = defineProps(["field", "fieldPath"]),

    fieldTypeComponentMap = {
      oneof: OneofInput,
      message: MessageInput,
      enum: EnumInput,
      primitive: PrimitiveInput,
    },

    InputComponent = computed(() => fieldTypeComponentMap[props.field.fieldType]),

    isRepeated = computed(() => props.field.rule === 'repeated' )
</script>
